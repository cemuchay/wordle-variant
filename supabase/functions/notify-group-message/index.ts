import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface MessageRecord {
  id: string;
  user_id: string;
  content?: string | null;
  reply_to?: string | null;
  group_id?: string | null;
  created_at?: string;
}

/**
 * Extracts unique @username mentions from message content.
 */
function extractMentions(content: string | null | undefined): string[] {
  if (!content) return [];
  const matches = content.match(/@([a-zA-Z0-9_]+)/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

/**
 * Truncates message content for push notification body.
 */
function formatPreview(content: string | null | undefined, maxLen = 100): string {
  if (!content) return "Sent a message";
  const trimmed = content.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify internal webhook secret
  const internalSecret = req.headers.get("x-internal-secret");
  if (internalSecret !== Deno.env.get("INTERNAL_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const record: MessageRecord | undefined = body.record ?? body;

    if (!record?.id || !record?.user_id) {
      return new Response(JSON.stringify({ sent: 0, reason: "Invalid message record" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip reaction signal rows
    if (record.content?.startsWith("[reaction:")) {
      return new Response(JSON.stringify({ sent: 0, reason: "Skipped reaction signal" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const PUBLIC_DEFAULT_GROUPS = new Set([
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
      "00000000-0000-0000-0000-000000000003",
    ]);

    // Skip private DM messages (only process public/group chat channels)
    if (record.group_id && !PUBLIC_DEFAULT_GROUPS.has(record.group_id)) {
      const { data: groupRow } = await supabaseAdmin
        .from("chat_groups")
        .select("type")
        .eq("id", record.group_id)
        .maybeSingle();

      if (groupRow?.type === "dm") {
        return new Response(JSON.stringify({ sent: 0, reason: "Skipped DM message" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT")!,
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );

    // Fetch sender username
    const { data: senderProfile } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", record.user_id)
      .maybeSingle();

    const senderName = senderProfile?.username || "Someone";
    const preview = formatPreview(record.content);

    // Track recipients with their notification reason (priority: reply > mention > daily_first)
    const recipientReasons = new Map<string, "reply" | "mention" | "daily_first">();

    // 1. Check if this is the first group message of the day (UTC)
    const now = record.created_at ? new Date(record.created_at) : new Date();
    const startOfDayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    ).toISOString();

    let earlierQuery = supabaseAdmin
      .from("messages")
      .select("id")
      .gte("created_at", startOfDayUtc)
      .neq("id", record.id)
      .limit(1);

    if (record.group_id) {
      earlierQuery = earlierQuery.eq("group_id", record.group_id);
    } else {
      earlierQuery = earlierQuery.is("group_id", null);
    }

    const { data: earlierMessages } = await earlierQuery;

    const isFirstOfDay = !earlierMessages || earlierMessages.length === 0;

    if (isFirstOfDay) {
      const { data: allSubs } = await supabaseAdmin
        .from("push_subscriptions")
        .select("user_id")
        .neq("user_id", record.user_id);

      for (const sub of allSubs || []) {
        if (sub.user_id) recipientReasons.set(sub.user_id, "daily_first");
      }
    }

    // 2. Resolve @username mentions
    const mentionedUsernames = extractMentions(record.content);
    if (mentionedUsernames.length > 0) {
      const { data: mentionedProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, username");

      const mentionSet = new Set(mentionedUsernames);
      for (const profile of mentionedProfiles || []) {
        if (
          profile.id !== record.user_id &&
          profile.username &&
          mentionSet.has(profile.username.toLowerCase())
        ) {
          recipientReasons.set(profile.id, "mention");
        }
      }
    }

    // 3. Resolve replied-to user
    if (record.reply_to) {
      const { data: parentMsg } = await supabaseAdmin
        .from("messages")
        .select("user_id")
        .eq("id", record.reply_to)
        .maybeSingle();

      if (parentMsg?.user_id && parentMsg.user_id !== record.user_id) {
        recipientReasons.set(parentMsg.user_id, "reply");
      }
    }

    if (recipientReasons.size === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "No eligible recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUserIds = Array.from(recipientReasons.keys());

    // Fetch push subscriptions for all target users
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    if (subError || !subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "No active subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;
    const expiredIds: string[] = [];

    // Send notifications
    await Promise.all(
      subscriptions.map(async (sub) => {
        const reason = recipientReasons.get(sub.user_id) || "daily_first";
        const title =
          reason === "reply"
            ? `${senderName} replied to you`
            : reason === "mention"
            ? `${senderName} mentioned you`
            : "Group Chat is active today";

        const targetChatUrl = record.group_id
          ? `/?open=chat&group_id=${record.group_id}`
          : "/?open=chat";

        const pushPayload = JSON.stringify({
          title,
          body: reason === "daily_first" ? `${senderName}: ${preview}` : preview,
          url: targetChatUrl,
          tag: `group-msg-${record.id}`,
        });

        try {
          const subTarget = sub.subscription?.endpoint
            ? sub.subscription
            : {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh || sub.subscription?.keys?.p256dh,
                  auth: sub.auth || sub.subscription?.keys?.auth,
                },
              };

          await webpush.sendNotification(subTarget, pushPayload);
          sentCount++;
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            expiredIds.push(sub.id);
          } else {
            console.error("Push send error:", err?.message || err);
          }
        }
      })
    );

    // Clean up expired subscriptions
    if (expiredIds.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", expiredIds);
    }

    return new Response(
      JSON.stringify({ sent: sentCount, cleaned: expiredIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("notify-group-message error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

