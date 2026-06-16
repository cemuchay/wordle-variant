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
      const { user_id, notification_id, title, body, url } = await req.json();

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
         .select("id, subscription")
         .eq("user_id", user_id);

      if (error || !subs) throw error || new Error("No subscriptions found");

      // Send notifications in parallel
      const notifications = subs.map((s) =>
         webpush.sendNotification(
            s.subscription,
            JSON.stringify({ title, body, url: url || "/" }),
         ),
      );

      const results = await Promise.allSettled(notifications);
      
      let successfulCount = 0;
      const staleIds: string[] = [];

      results.forEach((res, i) => {
         if (res.status === "fulfilled") {
            successfulCount++;
         } else {
            console.error(`[Push Error] Failed to send to subscription ${i}:`, res.reason);
            // 410 Gone means the subscription has expired or been revoked
            if (res.reason?.statusCode === 410) {
               staleIds.push(subs[i].id);
            }
         }
      });

      if (staleIds.length > 0) {
         console.log(`[Push Cleanup] Deleting ${staleIds.length} stale subscriptions...`);
         await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .in("id", staleIds);
      }

      // If at least one push notification succeeded, mark it in the database
      if (successfulCount > 0 && notification_id) {
         console.log(`[Push Success] Marking notification ${notification_id} as delivered via push...`);
         await supabaseAdmin
            .from("notifications")
            .update({ delivered_via_push: true })
            .eq("id", notification_id);
      }

      return new Response(JSON.stringify({ sent: subs.length, successful: successfulCount, results }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
   } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
         status: 400,
      });
   }
});
