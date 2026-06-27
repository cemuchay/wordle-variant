import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decodeHTML(html: string): string {
   if (!html) return "";
   return html
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&deg;/g, "°")
      .replace(/&micro;/g, "µ")
      .replace(/&nbsp;/g, " ")
      .replace(/&Oslash;/g, "Ø")
      .replace(/&plusmn;/g, "±");
}

serve(async (req) => {
   // Handle CORS
   if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
   }

   try {
      // ── Authenticate Cron Job Trigger ──
      const authHeader = req.headers.get("Authorization") || "";
      const internalSecret = Deno.env.get("INTERNAL_SECRET") || "";
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

      // Validate signature to prevent public spamming
      const tokenProvided = authHeader.replace(/Bearer /i, "").trim();
      const isValid = tokenProvided === internalSecret || tokenProvided === serviceRoleKey;

      if (!isValid) {
         return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

      console.log("[sync-otdb-trivia] Fetching OTDB Session Token...");
      const tokenRes = await fetch("https://opentdb.com/api_token.php?command=request");
      const tokenData = await tokenRes.json();
      const token = tokenData.token;

      const allCategories = [
         { id: 21, label: "Sports", internal: "sports" },
         { id: 19, label: "Mathematics", internal: "maths" },
         { id: 17, label: "Science & Nature", internal: "physics" }, // Mapped dynamically
         { id: 18, label: "Computers", internal: "computers" },
         { id: 22, label: "Geography", internal: "geography" },
         { id: 23, label: "History", internal: "history" },
         { id: 9, label: "General Knowledge", internal: "general_knowledge" },
         { id: 11, label: "Movies & Cinema", internal: "movies" },
         { id: 14, label: "Television", internal: "television" },
         { id: 15, label: "Video Games", internal: "video_games" },
         { id: 12, label: "Music", internal: "music" },
         { id: 27, label: "Animals", internal: "animals" }
      ];

      // Randomly select 4 categories to fetch per run to stay well within Deno timeout limits
      const categoriesToFetch = allCategories
         .sort(() => Math.random() - 0.5)
         .slice(0, 4);

      let totalInserted = 0;

      for (const cat of categoriesToFetch) {
         console.log(`[sync-otdb-trivia] Fetching category: ${cat.label}`);
         const url = `https://opentdb.com/api.php?amount=30&category=${cat.id}&type=multiple${token ? `&token=${token}` : ""}`;
         
         const res = await fetch(url);
         const data = await res.json();
         if (data.response_code !== 0) {
            console.warn(`[sync-otdb-trivia] API returned code ${data.response_code} for ${cat.label}`);
            continue;
         }

         const questions = data.results || [];
         const records: any[] = [];

         for (const q of questions) {
            const prompt = decodeHTML(q.question);
            const answer = decodeHTML(q.correct_answer);
            const choices = [q.correct_answer, ...q.incorrect_answers]
               .map(decodeHTML)
               .sort(() => Math.random() - 0.5);

            let internalCategory = "";

             if (cat.id === 17) {
                const promptLower = prompt.toLowerCase();
                if (
                   promptLower.includes("chemistry") || 
                   promptLower.includes("element") || 
                   promptLower.includes("atom") || 
                   promptLower.includes("molecule") || 
                   promptLower.includes("compound") ||
                   promptLower.includes("acid")
                ) {
                   internalCategory = "chemistry";
                } else if (
                   promptLower.includes("biology") || 
                   promptLower.includes("cell") || 
                   promptLower.includes("gene") || 
                   promptLower.includes("dna") || 
                   promptLower.includes("organism") || 
                   promptLower.includes("plant") ||
                   promptLower.includes("species")
                ) {
                   internalCategory = "biology";
                } else {
                   internalCategory = "physics";
                }
             } else {
                internalCategory = cat.internal;
             }

            if (internalCategory) {
               records.push({
                  category: internalCategory,
                  prompt,
                  choices,
                  answer,
                  explanation: `The correct answer is indeed "${answer}". (Curated via Open Trivia DB)`
               });
            }
         }

         if (records.length > 0) {
            const { error } = await supabaseClient
               .from("wordup_handcrafted_questions")
               .upsert(records, { onConflict: "prompt" });

            if (error) {
               console.error(`[sync-otdb-trivia] DB insert error for ${cat.label}:`, error.message);
            } else {
               totalInserted += records.length;
               console.log(`[sync-otdb-trivia] Mapped and upserted ${records.length} questions for ${cat.label}`);
            }
         }

         // Rate limit safety delay
         await new Promise((r) => setTimeout(r, 2000));
      }

      return new Response(JSON.stringify({ success: true, totalInserted }), {
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
