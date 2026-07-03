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
    const body = await req.json();
    const { action, timeframe, userId, key, date, challengeId, ignoreCache } = body;

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
      return await res.json();
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

      let cached = null;
      if (!ignoreCache) {
        cached = await runRedisCommand(["GET", cacheKey]);
      }

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
        ? `${baseSelect}, word_length, attempts, status, first_played_at`
        : `${baseSelect}, days_active`;

      const query = supabaseClient
        .from(viewName)
        .select(selectStr)
        .order("total_points", { ascending: false })
        .limit(20);

      if (timeframe === "today") {
        query.order("first_played_at", { ascending: true });
      }

      const { data, error } = await query;

      if (error) throw error;

      // TTL definitions:
      // today: 5s, yesterday: 86400s (24h), weekly: 300s (5m), monthly: 600s (10m)
      const ttlMap: Record<string, number> = {
        today: 5,
        yesterday: 86400,
        weekly: 300,
        monthly: 600,
      };
      const ttl = ttlMap[timeframe] || 5;

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

      // Augment with reigning badge info from user_awards
      if (profile) {
        const { data: badges } = await supabaseClient
          .rpc("get_user_reigning_badges", { p_user_id: userId });

        profile.is_reigning_weekly = badges?.[0]?.is_reigning_weekly ?? false;
        profile.is_reigning_bot_marathon = badges?.[0]?.is_reigning_bot_marathon ?? false;

        // Cache for 1 hour
        await runRedisCommand(["SET", cacheKey, JSON.stringify(profile), "EX", 3600]);
      }

      return new Response(JSON.stringify({ data: profile, cached: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-user-score") {
      if (!userId || !date) {
        return new Response(JSON.stringify({ error: "userId and date are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Authorization Check:
      // 1. Get caller info from JWT
      const { data: { user: caller } } = authHeader ? await supabaseClient.auth.getUser() : { data: { user: null } };

      if (!caller) {
        return new Response(JSON.stringify({ error: "Unauthorized: Please log in" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. If caller is requesting their own score, it's always allowed
      let isAllowed = userId === caller.id;

      if (!isAllowed) {
        // 3. Check if target date is in the past (yesterday or earlier)
        const lagosTodayStr = getLagosDate(null, 0);
        const isPastDate = date < lagosTodayStr;

        if (isPastDate) {
          isAllowed = true;
        } else {
          // 4. Otherwise (today or future), caller must have finished today's game (status 'won' or 'lost')
          const { data: callerScore, error: callerScoreErr } = await supabaseClient
            .from("scores")
            .select("status")
            .eq("user_id", caller.id)
            .eq("game_date", date)
            .maybeSingle();

          if (!callerScoreErr && callerScore && (callerScore.status === "won" || callerScore.status === "lost")) {
            isAllowed = true;
          }
        }
      }

      if (!isAllowed) {
        return new Response(JSON.stringify({ error: "Access Denied: You must complete today's game before viewing other players' guesses." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cacheKey = `score:${userId}:${date}`;
      const cached = await runRedisCommand(["GET", cacheKey]);

      if (cached && cached.result) {
        return new Response(JSON.stringify({ data: JSON.parse(cached.result), cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cache Miss: Query Database
      const { data: score, error } = await supabaseClient
        .from("scores")
        .select("guesses, hints_used, skill_score, hint_record, game_message")
        .eq("user_id", userId)
        .eq("game_date", date)
        .maybeSingle();

      if (error) throw error;

      if (score) {
        // Cache for 48 hours (172800 seconds)
        await runRedisCommand(["SET", cacheKey, JSON.stringify(score), "EX", 172800]);
      }

      return new Response(JSON.stringify({ data: score, cached: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-challenge") {
      if (!challengeId) {
        return new Response(JSON.stringify({ error: "challengeId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cacheKey = `challenge:lobby:${challengeId}`;
      const cached = await runRedisCommand(["GET", cacheKey]);

      if (cached && cached.result) {
        return new Response(JSON.stringify({ data: JSON.parse(cached.result), cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cache Miss: Query Database
      const { data: challenge, error } = await supabaseClient
        .from("challenges")
        .select(`
          *,
          creator:profiles!creator_id(username, avatar_url),
          participants:challenge_participants(
            *,
            profiles(username, avatar_url),
            guest_profiles(username, avatar_url),
            marathon_progress:challenge_participants_marathon(*)
          )
        `)
        .eq("id", challengeId)
        .maybeSingle();

      if (error) throw error;

      if (challenge) {
        // Check if expired
        const isExpired = new Date(challenge.expires_at) < new Date();
        // Expired challenges cached for 30 days (2592000s). Active challenges cached for 5 seconds (5s).
        const ttl = isExpired ? 2592000 : 5;

        await runRedisCommand(["SET", cacheKey, JSON.stringify(challenge), "EX", ttl]);
      }

      return new Response(JSON.stringify({ data: challenge, cached: false }), {
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
        await runRedisCommand(["DEL", `leaderboard:weekly`]);
        await runRedisCommand(["DEL", `leaderboard:monthly`]);
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
