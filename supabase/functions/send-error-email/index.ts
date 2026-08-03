import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ALERT_EMAIL = "cemuchay@gmail.com";
const FROM_EMAIL = (
   Deno.env.get("FROM_EMAIL") || "variant Alerts <updates@wordle-variant.xyz>"
).replace(/^["']|["']$/g, "");

const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
};

// In-memory deduplication map for warm Deno isolate instances
const inMemoryDedup = new Map<string, number>();
const DEDUP_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown per error per user

serve(async (req) => {
   if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
   }

   try {
      const { record } = await req.json();

      if (!record || record.level !== "fatal") {
         return new Response(
            JSON.stringify({ message: "Not a fatal log, skipping." }),
            {
               headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
         );
      }

      if (!RESEND_API_KEY) {
         console.error("RESEND_API_KEY not configured");
         return new Response(
            JSON.stringify({ error: "Email service not configured" }),
            {
               status: 500,
               headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
         );
      }

      const { message, context, session_id, user_id, created_at } = record;

      // ── Deduplication / Rate Limiting ──────────────────────────────────
      // Create a unique fingerprint key for the user and error signature
      const userKey = user_id || context?.username || session_id || "anon";
      const cleanMsg = String(message || "unknown_error").slice(0, 100).replace(/\d+/g, "#");
      const dedupKey = `err_email_dedup:${userKey}:${cleanMsg}`;

      const now = Date.now();

      // 1. Check in-memory isolate cache
      const lastSentInMemory = inMemoryDedup.get(dedupKey);
      if (lastSentInMemory && (now - lastSentInMemory < DEDUP_COOLDOWN_MS)) {
         console.log(`[send-error-email] Suppressing duplicate email (in-memory) for key: ${dedupKey}`);
         return new Response(
            JSON.stringify({ message: "Duplicate error email suppressed (in-memory rate limit).", suppressed: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
      }

      // 2. Check Upstash Redis cache across distributed edge instances
      const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
      const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

      if (upstashUrl && upstashToken) {
         try {
            // Try setting key with NX (Only set if Not eXists) and EX 900 (15 min TTL)
            const redisRes = await fetch(upstashUrl, {
               method: "POST",
               headers: {
                  Authorization: `Bearer ${upstashToken}`,
                  "Content-Type": "application/json",
               },
               body: JSON.stringify(["SET", dedupKey, "1", "NX", "EX", 900]),
            });

            if (redisRes.ok) {
               const redisData = await redisRes.json();
               // If Redis returned null, the key already existed!
               if (redisData.result !== "OK") {
                  console.log(`[send-error-email] Suppressing duplicate email (Redis) for key: ${dedupKey}`);
                  inMemoryDedup.set(dedupKey, now);
                  return new Response(
                     JSON.stringify({ message: "Duplicate error email suppressed (Redis rate limit).", suppressed: true }),
                     { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
               }
            }
         } catch (e) {
            console.warn("[send-error-email] Redis dedup check error:", e);
         }
      }

      // Record sent timestamp in-memory
      inMemoryDedup.set(dedupKey, now);

      // Clean up old in-memory entries periodically to prevent memory leaks
      if (inMemoryDedup.size > 500) {
         for (const [k, ts] of inMemoryDedup.entries()) {
            if (now - ts > DEDUP_COOLDOWN_MS) inMemoryDedup.delete(k);
         }
      }

      const emailResponse = await fetch("https://api.resend.com/emails", {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
         },
         body: JSON.stringify({
            from: FROM_EMAIL,
            to: [ALERT_EMAIL],
            subject: `🚨 CRITICAL CRASH: ${message}`,
            html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #e11d48; margin-bottom: 20px;">Critical System Error Detected</h2>
            
            <p><strong>Message:</strong> ${message}</p>
            <p><strong>Log Level:</strong> <span style="background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; font-weight: bold;">FATAL</span></p>
            <p><strong>Time:</strong> ${new Date(created_at).toLocaleString()}</p>
            <p><strong>Session ID:</strong> <code>${session_id}</code></p>
            <p><strong>User ID:</strong> ${user_id || "Anonymous"}</p>
            
            <h3 style="margin-top: 30px; border-bottom: 1px solid #eee; padding-bottom: 10px;">Context / Stack Trace</h3>
            <pre style="background: #f8fafc; padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 0.85em;">${JSON.stringify(context, null, 2)}</pre>
            
            <p style="margin-top: 30px; font-size: 0.8em; color: #64748b;">
              This alert was automatically generated by the Client-Side Logger.
            </p>
          </div>
        `,
         }),
      });

      const result = await emailResponse.json();

      return new Response(JSON.stringify(result), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
   } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
         status: 500,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
   }
});
