import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { runOtdbCuration } from "../_shared/otdbCurator.ts";

const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

serve(async (req) => {
   if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
   }

   try {
      // ── Authenticate (cron / admin trigger) ──
      const internalSecret = Deno.env.get("INTERNAL_SECRET") || "";
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const bearer = (req.headers.get("Authorization") || "").replace(/Bearer /i, "").trim();
      const headerSecret = req.headers.get("x-internal-secret") || "";
      const isValid =
         (!!internalSecret && (bearer === internalSecret || headerSecret === internalSecret)) ||
         (!!serviceRoleKey && bearer === serviceRoleKey);

      if (!isValid) {
         return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
      }

      const body = await req.json().catch(() => ({}));
      const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") || "", serviceRoleKey);

      const result = await runOtdbCuration(supabaseClient, {
         maxCategories: Math.min(Number(body.maxCategories) || 4, 6),
         amountPerCategory: Math.min(Number(body.amount) || 30, 50),
         ttlDays: Number(body.ttlDays) || 30,
         timeoutMs: 45_000,
         categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds.map(Number) : undefined,
      });

      return new Response(JSON.stringify({ success: true, ...result, totalInserted: result.inserted }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
   } catch (err: any) {
      console.error("[sync-otdb-trivia] Exception:", err.message);
      return new Response(JSON.stringify({ error: err.message }), {
         status: 500,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
   }
});
