import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import formatUsername from "../_shared/formatUsername.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("uid");

    if (!userId) {
      return new Response("Missing uid", { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "text/plain" } 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Check profiles table first
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("avatar_url, username")
      .eq("id", userId)
      .maybeSingle();

    let avatarUrl = profile?.avatar_url;
    let username = profile?.username || "";

    // 2. Check guest_profiles if not found in profiles
    if (!avatarUrl) {
      const { data: guestProfile } = await supabaseClient
        .from("guest_profiles")
        .select("avatar_url, username")
        .eq("id", userId)
        .maybeSingle();
      if (guestProfile) {
        avatarUrl = guestProfile.avatar_url;
        username = guestProfile.username || "";
      }
    }

    // 3. Fallback to UI-avatars if no url found
    if (!avatarUrl) {
      const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(formatUsername(username) || "User")}`;
      return Response.redirect(fallbackUrl, 302);
    }

    // 4. Fetch the avatar image (bypasses browser CORS constraints)
    const imageRes = await fetch(avatarUrl);
    if (!imageRes.ok) {
      const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(formatUsername(username) || "User")}`;
      return Response.redirect(fallbackUrl, 302);
    }

    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set("Content-Type", imageRes.headers.get("Content-Type") || "image/png");
    // Cache for 7 days, allowing revalidation in background
    responseHeaders.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");

    return new Response(imageRes.body, {
      headers: responseHeaders,
    });
  } catch (e) {
    console.error("Proxy avatar error:", e);
    return new Response("Internal Server Error", { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "text/plain" } 
    });
  }
});
