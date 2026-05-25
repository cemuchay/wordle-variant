import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Wordle Variant <onboarding@resend.dev>";
const APP_URL = Deno.env.get("APP_URL") || "https://wordle-variant.vercel.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

// Sleek dark mode HTML email template wrapper
const getEmailHtml = (username: string, userId: string, title: string, contentHtml: string) => {
  const unsubscribeUrl = `${APP_URL}/unsubscribe?user_id=${userId}`;
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            background-color: #030712;
            color: #f3f4f6;
            font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
          }
          .card {
            background-color: #111827;
            border: 1px solid #1f2937;
            border-radius: 24px;
            padding: 32px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
          }
          .header-accent {
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            height: 6px;
            border-radius: 12px;
            margin-bottom: 24px;
          }
          h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 900;
            margin-top: 0;
            margin-bottom: 16px;
            text-transform: uppercase;
            letter-spacing: -0.025em;
          }
          p {
            color: #9ca3af;
            font-size: 15px;
            line-height: 1.625;
            margin-top: 0;
            margin-bottom: 24px;
          }
          .btn-primary {
            display: inline-block;
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            color: #ffffff !important;
            font-size: 13px;
            font-weight: 800;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3);
            text-align: center;
          }
          .footer {
            margin-top: 32px;
            text-align: center;
            border-top: 1px solid #1f2937;
            padding-top: 24px;
          }
          .footer-text {
            color: #4b5563;
            font-size: 11px;
            line-height: 1.5;
            margin: 0;
          }
          .footer-link {
            color: #6366f1;
            text-decoration: none;
            font-weight: 700;
          }
          .footer-link:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header-accent"></div>
            <h1>${title}</h1>
            <p>Hey <strong>${username}</strong>,</p>
            ${contentHtml}
            <div class="footer">
              <p class="footer-text">
                Sent automatically by Wordle Variant. If you wish to stop receiving these emails, you can 
                <a href="${unsubscribeUrl}" class="footer-link">unsubscribe here</a>.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authorize: Either internal secret matches or service role
    const internalSecret = req.headers.get("x-internal-secret");
    const expectedSecret = Deno.env.get("INTERNAL_SECRET");
    
    if (!internalSecret || internalSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized access" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json();

    if (!action) {
      return new Response(JSON.stringify({ error: "action parameter is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase Client with service key to bypass RLS for triggers
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const sendResendEmail = async (to: string, subject: string, html: string) => {
      if (!RESEND_API_KEY) {
        console.warn("RESEND_API_KEY not configured. Skipping Resend email send.");
        return null;
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [to],
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`Resend email delivery failed to ${to}. Status: ${res.status}. Error: ${errText}`);
      } else {
        console.log(`Successfully queued email to ${to} via Resend`);
      }
      return res;
    };

    const sendZohoEmail = async (to: string, subject: string, html: string) => {
      const smtpHost = Deno.env.get("ZOHO_SMTP_HOST") || "smtp.zoho.com";
      const smtpPort = parseInt(Deno.env.get("ZOHO_SMTP_PORT") || "465");
      const smtpUser = Deno.env.get("ZOHO_SMTP_USER");
      const smtpPass = Deno.env.get("ZOHO_SMTP_PASS");

      if (!smtpUser || !smtpPass) {
        console.warn("Zoho SMTP credentials not fully configured. Skipping fallback.");
        return false;
      }

      try {
        const nodemailer = await import("https://esm.sh/nodemailer@6.9.9");
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        const mailOptions = {
          from: `Wordle Variant <${smtpUser}>`,
          to,
          subject,
          html,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Successfully sent fallback email via Zoho SMTP to ${to}`);
        return true;
      } catch (err) {
        console.error(`Failed to send fallback email via Zoho SMTP to ${to}:`, err.message);
        return false;
      }
    };

    const sendEmailWithFallback = async (to: string, subject: string, html: string) => {
      // 1. Try Resend
      try {
        const res = await sendResendEmail(to, subject, html);
        if (res && res.ok) {
          return true;
        }
        if (res) {
          const errText = await res.text();
          console.warn(`Resend failed with status ${res.status}: ${errText}. Attempting Zoho fallback...`);
        } else {
          console.warn(`Resend skipped. Attempting Zoho fallback...`);
        }
      } catch (err) {
        console.warn(`Resend failed with error: ${err.message}. Attempting Zoho fallback...`);
      }

      // 2. Fallback to Zoho
      return await sendZohoEmail(to, subject, html);
    };

    let sentCount = 0;

    // ACTION: MORNING REMINDERS
    if (action === "morning-reminders") {
      // A. Fetch skipped day recipients
      const { data: skippedRecipients, error: skippedErr } = await supabase.rpc("get_skipped_day_recipients");
      if (skippedErr) throw skippedErr;

      if (skippedRecipients && skippedRecipients.length > 0) {
        for (const recipient of skippedRecipients) {
          const content = `
            <p>You skipped playing yesterday! Don't let your daily Wordle momentum slip away.</p>
            <p>Challenge yourself, stay sharp, and maintain your standing by playing today's puzzle right now!</p>
            <div style="margin: 32px 0 16px 0; text-align: center;">
              <a href="${APP_URL}" class="btn-primary">Resume Play Now</a>
            </div>
          `;
          const html = getEmailHtml(recipient.username, recipient.user_id, "Resume your play today! ⚡", content);
          const success = await sendEmailWithFallback(recipient.email, "Resume your play today! ⚡", html);
          if (success) sentCount++;
        }
      }

      // B. Fetch 3-day inactive recipients (on Mondays)
      const lagosDay = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Lagos", weekday: "long" }).format(new Date());
      const isMonday = lagosDay.startsWith("Monday");

      if (isMonday) {
        const { data: inactiveRecipients, error: inactiveErr } = await supabase.rpc("get_three_day_inactive_recipients");
        if (inactiveErr) throw inactiveErr;

        if (inactiveRecipients && inactiveRecipients.length > 0) {
          for (const recipient of inactiveRecipients) {
            const content = `
              <p>It's been at least 3 days since you last logged in to play Wordle Variant.</p>
              <p>The weekly leaderboard is already heating up! Jump back in, crack today's word, and start climbing the ranks.</p>
              <div style="margin: 32px 0 16px 0; text-align: center;">
                <a href="${APP_URL}" class="btn-primary">Rejoin Leaderboard</a>
              </div>
            `;
            const html = getEmailHtml(recipient.username, recipient.user_id, "The Leaderboard Misses You! 🧩", content);
            const success = await sendEmailWithFallback(recipient.email, "The Leaderboard Misses You! 🧩", html);
            if (success) sentCount++;
          }
        }
      }

      return new Response(JSON.stringify({ success: true, action, emails_sent: sentCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: EVENING REMINDERS (Streak Warnings)
    if (action === "evening-reminders") {
      const { data: recipients, error: err } = await supabase.rpc("get_streak_warning_recipients");
      if (err) throw err;

      if (recipients && recipients.length > 0) {
        for (const recipient of recipients) {
          const content = `
            <p>You have an active <strong>${recipient.current_streak}-day winning streak</strong> but haven't played today yet!</p>
            <p>It is already past 7:00 PM WAT. Don't let all your hard work go to waste—solve today's Wordle before midnight to keep your streak alive!</p>
            <div style="margin: 32px 0 16px 0; text-align: center;">
              <a href="${APP_URL}" class="btn-primary">Save My Streak</a>
            </div>
          `;
          const html = getEmailHtml(recipient.username, recipient.user_id, "⚠️ Streak Warning!", content);
          const success = await sendEmailWithFallback(recipient.email, `⚠️ Streak Warning: Save your ${recipient.current_streak}-day streak!`, html);
          if (success) sentCount++;
        }
      }

      return new Response(JSON.stringify({ success: true, action, emails_sent: sentCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: WEEKLY REPORT
    if (action === "weekly-report") {
      // 1. Fetch Leaderboard for previous week
      const { data: leaderboard, error: lbErr } = await supabase.rpc("get_weekly_report_leaderboard");
      if (lbErr) throw lbErr;

      // 2. Fetch Weekly Report recipients (played at least 1 game last week)
      const { data: recipients, error: recErr } = await supabase.rpc("get_weekly_report_recipients");
      if (recErr) throw recErr;

      if (recipients && recipients.length > 0 && leaderboard && leaderboard.length > 0) {
        for (const recipient of recipients) {
          // Find player's standing
          const myIndex = leaderboard.findIndex((entry) => entry.username === recipient.username);
          const myRank = myIndex !== -1 ? myIndex + 1 : null;
          const myPoints = myIndex !== -1 ? leaderboard[myIndex].total_points : 0;
          const myDaysActive = myIndex !== -1 ? leaderboard[myIndex].days_active : 0;

          // Determine relative leaderboard window (current user + up to 10 others close to them)
          let start = 0;
          let end = 10;
          if (myIndex !== -1) {
            start = Math.max(0, myIndex - 5);
            end = Math.min(leaderboard.length, myIndex + 6); // +6 for exclusive end range
            
            // Adjust window if near bounds to keep total size at 11 if possible
            if (myIndex - start < 5) {
              end = Math.min(leaderboard.length, start + 11);
            } else if (end - myIndex < 6) {
              start = Math.max(0, end - 11);
            }
          }

          const relativeLeaderboard = leaderboard.slice(start, end);
          let tableRowsHtml = "";

          relativeLeaderboard.forEach((entry) => {
            const globalIdx = leaderboard.findIndex((e) => e.username === entry.username);
            const rank = globalIdx + 1;
            const isMe = entry.username === recipient.username;
            
            const rankColor = rank === 1 ? "#fbbf24" : rank === 2 ? "#d1d5db" : rank === 3 ? "#b45309" : "#ffffff";
            const rankLabel = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
            
            const rowStyle = isMe 
              ? "background-color: #1e1b4b; border-left: 4px solid #6366f1;" 
              : "border-bottom: 1px solid #1f2937;";
            const textStyle = isMe 
              ? "font-weight: 800; color: #a5b4fc;" 
              : "color: #ffffff;";

            tableRowsHtml += `
              <tr style="${rowStyle}">
                <td style="padding: 12px 8px; font-weight: 800; color: ${rankColor};">${rankLabel}</td>
                <td style="padding: 12px 8px; font-weight: bold; ${textStyle}">${entry.username}${isMe ? " (You)" : ""}</td>
                <td style="padding: 12px 8px; text-align: right; font-weight: 900; color: #6366f1;">${entry.total_points}</td>
                <td style="padding: 12px 8px; text-align: right; color: #9ca3af; font-size: 13px;">${entry.days_active}d</td>
              </tr>
            `;
          });

          const leaderboardTableHtml = `
            <table style="width: 100%; border-collapse: collapse; margin: 24px 0; background-color: #0b0f19; border-radius: 12px; overflow: hidden;">
              <thead>
                <tr style="background-color: #1f2937; border-bottom: 2px solid #374151;">
                  <th style="padding: 12px 8px; text-align: left; font-size: 11px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Rank</th>
                  <th style="padding: 12px 8px; text-align: left; font-size: 11px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Player</th>
                  <th style="padding: 12px 8px; text-align: right; font-size: 11px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Points</th>
                  <th style="padding: 12px 8px; text-align: right; font-size: 11px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Active</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>
          `;

          let statsSummaryHtml = "";
          if (myRank) {
            statsSummaryHtml = `
              <div style="background-color: #1e1b4b; border: 1px solid #312e81; border-radius: 16px; padding: 18px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; font-size: 12px; text-transform: uppercase; font-weight: 900; color: #c7d2fe; letter-spacing: 0.05em;">Your Performance</p>
                <div style="display: flex; justify-content: space-around; margin-top: 12px;">
                  <div>
                    <span style="display: block; font-size: 20px; font-weight: 900; color: #ffffff;">#${myRank}</span>
                    <span style="font-size: 10px; color: #a5b4fc; text-transform: uppercase;">Rank</span>
                  </div>
                  <div>
                    <span style="display: block; font-size: 20px; font-weight: 900; color: #ffffff;">${myPoints}</span>
                    <span style="font-size: 10px; color: #a5b4fc; text-transform: uppercase;">Points</span>
                  </div>
                  <div>
                    <span style="display: block; font-size: 20px; font-weight: 900; color: #ffffff;">${myDaysActive}d</span>
                    <span style="font-size: 10px; color: #a5b4fc; text-transform: uppercase;">Active</span>
                  </div>
                </div>
              </div>
            `;
          }

          const content = `
            <p>Here is your weekly report for the previous week (Monday to Sunday).</p>
            ${statsSummaryHtml}
            <h3 style="color: #ffffff; font-size: 16px; font-weight: 800; margin: 24px 0 12px 0; text-transform: uppercase; letter-spacing: -0.025em;">Weekly Leaderboard (Your Window)</h3>
            ${leaderboardTableHtml}
            <div style="margin: 32px 0 16px 0; text-align: center;">
              <a href="${APP_URL}" class="btn-primary">View Full Leaderboard</a>
            </div>
          `;

          const html = getEmailHtml(recipient.username, recipient.user_id, "Your Weekly Report 📊", content);
          const success = await sendEmailWithFallback(recipient.email, "Your Wordle Variant Weekly Report 📊", html);
          if (success) sentCount++;
        }
      }

      return new Response(JSON.stringify({ success: true, action, emails_sent: sentCount }), {
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
