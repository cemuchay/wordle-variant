import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
   // Handle CORS preflight
   if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
   }

   try {
      const { user_id, title, body } = await req.json();

      // Initialize Supabase Admin (Bypasses RLS to fetch all user devices)
      const supabaseAdmin = createClient(
         Deno.env.get("SUPABASE_URL") ?? "",
         Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      // Get VAPID keys from env
      webpush.setVapidDetails(
         Deno.env.get("VAPID_SUBJECT")!,
         Deno.env.get("VAPID_PUBLIC_KEY")!,
         Deno.env.get("VAPID_PRIVATE_KEY")!,
      );

      // Fetch subscriptions for the specific user
      const { data: subs, error } = await supabaseAdmin
         .from("push_subscriptions")
         .select("subscription")
         .eq("user_id", user_id);

      if (error || !subs) throw error || new Error("No subscriptions found");

      // Send notifications in parallel
      const notifications = subs.map((s) =>
         webpush.sendNotification(
            s.subscription,
            JSON.stringify({ title, body }),
         ),
      );

      await Promise.allSettled(notifications);

      return new Response(JSON.stringify({ sent: subs.length }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
   } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
         status: 400,
      });
   }
});
