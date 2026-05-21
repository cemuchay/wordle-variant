import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

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
    const { action, timeframe, userId, key, date } = await req.json();

    const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

    if (!upstashUrl || !upstashToken) {
      throw new Error("Upstash Redis secrets are not configured in Supabase env.");
    }

    const runRedisCommand = async (command: any[]) => {
      const res = await fetch(upstashUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      });
      if (!res.ok) {
        throw new Error(`Upstash API error: ${res.statusText}`);
      }
    };

    const getLagosDate = (baseDateStr: string | null, offsetDays = 0) => {
      const lagosTodayStr = baseDateStr || new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      if (offsetDays === 0) {
        return lagosTodayStr;
      }

      const [year, month, day] = lagosTodayStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      d.setDate(d.getDate() + offsetDays);

      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    };

    const getLagosDate = (baseDateStr: string | null, offsetDays = 0) => {
      const lagosTodayStr = baseDateStr || new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      if (offsetDays === 0) {
        return lagosTodayStr;
      }

      const [year, month, day] = lagosTodayStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      d.setDate(d.getDate() + offsetDays);

      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    };

    const getLagosDate = (baseDateStr: string | null, offsetDays = 0) => {
      const lagosTodayStr = baseDateStr || new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      if (offsetDays === 0) {
        return lagosTodayStr;
      }

      const [year, month, day] = lagosTodayStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      d.setDate(d.getDate() + offsetDays);

      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    };

    const getLagosDate = (baseDateStr: string | null, offsetDays = 0) => {
      const lagosTodayStr = baseDateStr || new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      if (offsetDays === 0) {
        return lagosTodayStr;
      }

      const [year, month, day] = lagosTodayStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      d.setDate(d.getDate() + offsetDays);

      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    };

    // Initialize Supabase Client using caller's authentication headers (enforces RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : undefined,
      },
    });

    if (action === "get-leaderboard") {
      if (!timeframe) {
        return new Response(JSON.stringify({ error: "timeframe is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let cacheKey = `leaderboard:${timeframe}`;
      if (timeframe === "today") {
        cacheKey = `leaderboard:daily:${getLagosDate(date, 0)}`;
      } else if (timeframe === "yesterday") {
        cacheKey = `leaderboard:daily:${getLagosDate(date, -1)}`;
      }

      const cached = await runRedisCommand(["GET", cacheKey]);

      if (cached && cached.result) {
        return new Response(JSON.stringify({ data: JSON.parse(cached.result), cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cache Miss: Query Database Views
      const viewMap: Record<string, string> = {
        today: "leaderboard_today",
        yesterday: "leaderboard_yesterday",
        weekly: "leaderboard_weekly",
        monthly: "leaderboard_monthly",
      };

      const viewName = viewMap[timeframe];
      if (!viewName) {
        return new Response(JSON.stringify({ error: `Invalid timeframe: ${timeframe}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isDailyView = timeframe === "today" || timeframe === "yesterday";
      const baseSelect = "username, avatar_url, total_points, user_id";
      const selectStr = isDailyView
        ? `${baseSelect}, word_length, attempts, status`
        : `${baseSelect}, days_active`;

      const { data, error } = await supabaseClient
        .from(viewName)
        .select(selectStr)
        .order("total_points", { ascending: false })
        .limit(20);

      if (error) throw error;

      // TTL definitions:
      // today: 60s (1m), yesterday: 86400s (24h), weekly: 300s (5m), monthly: 600s (10m)
      const ttlMap: Record<string, number> = {
        today: 60,
        yesterday: 86400,
        weekly: 300,
        monthly: 600,
      };
      const ttl = ttlMap[timeframe] || 60;

      // Format data to match LeaderboardEntry shape
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedData = (data || []).map((entry: any) => ({
        username: entry.username,
        avatar_url: entry.avatar_url,
        total_score: entry.total_points,
        word_length: entry.word_length ?? null,
        attempts: entry.attempts ?? null,
        status: entry.status,
        days_active: entry.days_active ?? 0,
        user_id: entry.user_id ?? null,
      }));

      // Cache it
      await runRedisCommand(["SET", cacheKey, JSON.stringify(formattedData), "EX", ttl]);

      return new Response(JSON.stringify({ data: formattedData, cached: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-user-profile") {
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cacheKey = `profile:${userId}`;
      const cached = await runRedisCommand(["GET", cacheKey]);

      if (cached && cached.result) {
        return new Response(JSON.stringify({ data: JSON.parse(cached.result), cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cache Miss: Query profiles table
      const { data: profile, error } = await supabaseClient
        .from("profiles")
        .select("id, username, avatar_url, updated_at, last_seen_at, daily_wins, weekly_wins, monthly_wins")
        .eq("id", userId)
        .single();

      if (error) throw error;

      // Cache for 1 hour
      if (profile) {
        await runRedisCommand(["SET", cacheKey, JSON.stringify(profile), "EX", 3600]);
      }

      return new Response(JSON.stringify({ data: profile, cached: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "invalidate") {
      if (!key) {
        return new Response(JSON.stringify({ error: "key is required for invalidation" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Authorize: Either internal secret matches or user session exists
      const internalSecret = req.headers.get("x-internal-secret");
      const isValidSecret = internalSecret && internalSecret === Deno.env.get("INTERNAL_SECRET");

      const { data: { user } } = authHeader ? await supabaseClient.auth.getUser() : { data: { user: null } };

      if (!isValidSecret && !user) {
        return new Response(JSON.stringify({ error: "Unauthorized invalidation request" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (key === "leaderboard:today") {
        const todayStr = getLagosDate(null, 0);
        const yesterdayStr = getLagosDate(null, -1);
        await runRedisCommand(["DEL", `leaderboard:daily:${todayStr}`]);
        await runRedisCommand(["DEL", `leaderboard:daily:${yesterdayStr}`]);
      } else {
        await runRedisCommand(["DEL", key]);
      }

      return new Response(JSON.stringify({ success: true, invalidated: key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
