import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

// Define Expected Payload (Standard or Supabase Webhook)
interface PushPayload {
   user_id?: string;
   notification_id?: string;
   title?: string;
   body?: string;
   url?: string;
   // Webhook specific fields
   record?: any;
   type?: string;
   table?: string;
}

Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
   }

   // Security Check
   const internalSecret = req.headers.get("x-internal-secret");
   if (internalSecret !== Deno.env.get("INTERNAL_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
         status: 401,
         headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
   }

   try {
      const body = await req.json();
      let payload: { user_id: string; notification_id?: string; title: string; body: string; url: string };

      // Handle Supabase Webhook format
      if (body.record && body.table === "notifications") {
         const record = body.record;
         let targetUrl = "/";

         // Move URL logic from SQL to TypeScript
         if (['CHALLENGE_INVITE', 'CHALLENGE_STARTED', 'CHALLENGE_COMPLETED', 'MARATHON_GAME_COMPLETED'].includes(record.type)) {
            if (record.data?.challenge_id) {
               targetUrl = `/?challenge=${record.data.challenge_id}`;
            }
         } else if (record.type === 'DM_MESSAGE') {
            if (record.data?.group_id) {
               targetUrl = `/?open=chat&group_id=${record.data.group_id}`;
            }
         } else if (record.type === 'LEADERBOARD_OVERTAKEN') {
            targetUrl = '/?open=leaderboard';
         }

         payload = {
            user_id: record.user_id,
            notification_id: record.id,
            title: record.title || "New Notification",
            body: record.message || "You have a new update.",
            url: targetUrl
         };
      } else {
         // Handle manual/legacy format
         payload = {
            user_id: body.user_id,
            notification_id: body.notification_id,
            title: body.title || "New Notification",
            body: body.body || "You have a new update.",
            url: body.url || "/"
         };
      }

      if (!payload.user_id) {
         throw new Error("Missing user_id in payload");
      }

      const supabaseAdmin = createClient(
         Deno.env.get("SUPABASE_URL")!,
         Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      webpush.setVapidDetails(
         Deno.env.get("VAPID_SUBJECT")!,
         Deno.env.get("VAPID_PUBLIC_KEY")!,
         Deno.env.get("VAPID_PRIVATE_KEY")!,
      );

      const { data: subs, error } = await supabaseAdmin
         .from("push_subscriptions")
         .select("id, subscription")
         .eq("user_id", payload.user_id);

      if (error) throw error;
      
      if (!subs || subs.length === 0) {
         return new Response(JSON.stringify({ sent: 0, message: "No subscriptions found" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
      }

      const results = await Promise.allSettled(
         subs.map((s) =>
            webpush.sendNotification(
               s.subscription,
               JSON.stringify({ 
                  title: payload.title, 
                  body: payload.body, 
                  url: payload.url 
               }),
            )
         )
      );

      let successfulCount = 0;
      const staleIds: string[] = [];

      results.forEach((res, i) => {
         if (res.status === "fulfilled") {
            successfulCount++;
         } else {
            const error = res.reason;
            if (error?.statusCode === 410 || error?.statusCode === 404) {
               staleIds.push(subs[i].id);
            }
         }
      });

      if (staleIds.length > 0) {
         await supabaseAdmin.from("push_subscriptions").delete().in("id", staleIds);
      }

      if (successfulCount > 0 && payload.notification_id) {
         await supabaseAdmin
            .from("notifications")
            .update({ delivered_via_push: true })
            .eq("id", payload.notification_id);
      }

      return new Response(
         JSON.stringify({ sent: subs.length, successful: successfulCount }),
         { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
   } catch (err: any) {
      console.error("[Push Fatal Error]", err);
      return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
         status: 400,
      });
   }
});
