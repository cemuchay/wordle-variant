import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import formatUsername from "../_shared/formatUsername.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = (
   Deno.env.get("FROM_EMAIL") || "Variant <updates@wordle-variant.xyz>"
).replace(/^["']|["']$/g, "");
const APP_URL = Deno.env.get("APP_URL") || "https://wordle-variant.xyz";

// Helper to convert Dicebear SVG to PNG and handle fallbacks for email client rendering (like Gmail)
const getAvatarUrl = (
   avatarUrl: string | null | undefined,
   username: string,
): string => {
   if (!avatarUrl) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(formatUsername(username))}&background=6366f1&color=fff&size=128`;
   }
   if (avatarUrl.includes("api.dicebear.com") && avatarUrl.includes("/svg")) {
      return avatarUrl.replace("/svg", "/png");
   }
   return avatarUrl;
};

const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

// Sleek dark mode HTML email template wrapper
const getEmailHtml = (
   username: string,
   userId: string,
   title: string,
   contentHtml: string,
) => {
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
            <p>Hey <strong>${formatUsername(username)}</strong>,</p>
            ${contentHtml}
            <div class="footer">
              <p class="footer-text">
                Sent automatically by variant. If you wish to stop receiving these emails, you can 
                <a href="${unsubscribeUrl}" class="footer-link">unsubscribe here</a>.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

// Helper to append logs to a sleek email HTML template for developer eyes
const appendLogsToHtml = (originalHtml: string, logs: string[]) => {
   const logsBlock = `
    <div style="margin-top: 40px; border-top: 2px dashed #374151; padding-top: 24px;">
      <h3 style="color: #6366f1; font-size: 14px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em; font-family: sans-serif;">Execution Logs (Dev Only)</h3>
      <pre style="background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 12px; padding: 16px; margin: 0; color: #10b981; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.5; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">${logs.join("\n")}</pre>
    </div>
  `;
   return originalHtml.replace("</body>", `${logsBlock}</body>`);
};

// Helper to get HTML body containing only execution logs (e.g., when no emails are sent)
const getLogsOnlyHtml = (action: string, logs: string[]) => {
   const content = `
    <p>No email reminders were sent to any users for <strong>${action}</strong> because no users were eligible.</p>
    <div style="margin-top: 24px;">
      <h3 style="color: #6366f1; font-size: 14px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em; font-family: sans-serif;">Execution Logs</h3>
      <pre style="background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 12px; padding: 16px; margin: 0; color: #10b981; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.5; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">${logs.join("\n")}</pre>
    </div>
  `;
   return getEmailHtml("Developer", "dev", `[Logs] ${action}`, content);
};

serve(async (req) => {
   if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
   }

   const logs: string[] = [];
   const log = (msg: string) => {
      console.log(msg);
      logs.push(`[${new Date().toISOString()}] ${msg}`);
   };

   let action = "unknown";

   const sendResendEmail = async (
      to: string,
      subject: string,
      html: string,
   ) => {
      if (!RESEND_API_KEY) {
         log("RESEND_API_KEY not configured. Skipping Resend email send.");
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
         log(
            `Resend email delivery failed to ${to}. Status: ${res.status}. Error: ${errText}`,
         );
      } else {
         log(`Successfully queued email to ${to} via Resend`);
      }
      return res;
   };

   const sendZohoEmail = async (to: string, subject: string, html: string) => {
      const smtpHost = Deno.env.get("ZOHO_SMTP_HOST") || "smtp.zoho.com";
      const smtpPort = parseInt(Deno.env.get("ZOHO_SMTP_PORT") || "465");
      const smtpUser = Deno.env.get("ZOHO_SMTP_USER");
      const smtpPass = Deno.env.get("ZOHO_SMTP_PASS");

      if (!smtpUser || !smtpPass) {
         log("Zoho SMTP credentials not fully configured. Skipping fallback.");
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
            from: `variant <${smtpUser}>`,
            to,
            subject,
            html,
         };

         await transporter.sendMail(mailOptions);
         log(`Successfully sent fallback email via Zoho SMTP to ${to}`);
         return true;
      } catch (err) {
         log(
            `Failed to send fallback email via Zoho SMTP to ${to}: ${(err as any).message}`,
         );
         return false;
      }
   };

   const sendEmailWithFallback = async (
      to: string,
      subject: string,
      html: string,
   ) => {
      // 1. Try Resend
      try {
         const res = await sendResendEmail(to, subject, html);
         if (res && res.ok) {
            return true;
         }
         if (res) {
            log(
               `Resend failed with status ${res.status}. Attempting Zoho fallback...`,
            );
         } else {
            log("Resend skipped. Attempting Zoho fallback...");
         }
      } catch (err) {
         log(
            `Resend failed with error: ${(err as any).message}. Attempting Zoho fallback...`,
         );
      }

      // 2. Fallback to Zoho
      return await sendZohoEmail(to, subject, html);
   };

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

      const body = await req.json().catch(() => ({}));
      action = body.action || "unknown";

      if (action === "unknown") {
         return new Response(
            JSON.stringify({ error: "action parameter is required" }),
            {
               status: 400,
               headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
         );
      }

      // Initialize Supabase Client with service key to bypass RLS for triggers
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      let sentCount = 0;

      // ACTION: WELCOME EMAIL (On User Signup)
      if (action === "welcome-email") {
         log(`Starting action welcome-email`);

         const targetEmail = body.email;
         const targetUsername = formatUsername(body.username) || "Player";
         const targetUserId = body.userId || "welcome-user";

         if (!targetEmail) {
            log(`Error: email parameter is required for welcome-email action`);
            return new Response(
               JSON.stringify({ error: "email parameter is required" }),
               {
                  status: 400,
                  headers: {
                     ...corsHeaders,
                     "Content-Type": "application/json",
                  },
               },
            );
         }

         log(
            `Sending welcome email to ${targetEmail} (Username: ${targetUsername})...`,
         );

         const content = `
        <p>Welcome to <strong>variant</strong>! We are thrilled to have you join our community of word puzzle enthusiasts. Whether you are a casual player or a competitive solver, here is everything you need to know to get started and dominate the leaderboards.</p>
        
        <div style="margin: 24px 0; background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 16px; padding: 20px;">
          <h3 style="color: #6366f1; font-size: 16px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em; font-family: sans-serif;">🧩 Daily Puzzles</h3>
          <p style="margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #9ca3af;">Each day brings a fresh word puzzle. Choose your difficulty with <strong>4, 5, 6, or 7-letter</strong> words and solve in 6 attempts. After each guess, the tiles change color to show how close you are:</p>
          <ul style="color: #9ca3af; font-size: 14px; padding-left: 20px; line-height: 1.6; margin-bottom: 16px;">
            <li><strong style="color: #10b981;">Green:</strong> The letter is correct and in the right spot.</li>
            <li><strong style="color: #f59e0b;">Yellow:</strong> The letter is in the word but in a different spot.</li>
            <li><strong style="color: #4b5563;">Gray:</strong> The letter is not in the word at all.</li>
          </ul>
          <div style="text-align: center; margin: 20px 0;">
            <!-- Native HTML/CSS Wordle Board Mockup (Instant load/fallback) -->
            <div style="margin: 10px auto 20px auto; max-width: 250px; text-align: center;">
              <div style="display: flex; justify-content: center; gap: 6px; margin-bottom: 6px;">
                <div style="width: 38px; height: 38px; background-color: #3a3a3c; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">W</div>
                <div style="width: 38px; height: 38px; background-color: #3a3a3c; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">E</div>
                <div style="width: 38px; height: 38px; background-color: #3a3a3c; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">A</div>
                <div style="width: 38px; height: 38px; background-color: #b59f3b; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">R</div>
                <div style="width: 38px; height: 38px; background-color: #3a3a3c; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">Y</div>
              </div>
              <div style="display: flex; justify-content: center; gap: 6px; margin-bottom: 6px;">
                <div style="width: 38px; height: 38px; background-color: #538d4e; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">P</div>
                <div style="width: 38px; height: 38px; background-color: #3a3a3c; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">I</div>
                <div style="width: 38px; height: 38px; background-color: #3a3a3c; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">L</div>
                <div style="width: 38px; height: 38px; background-color: #b59f3b; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">O</div>
                <div style="width: 38px; height: 38px; background-color: #3a3a3c; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">T</div>
              </div>
              <div style="display: flex; justify-content: center; gap: 6px; margin-bottom: 6px;">
                <div style="width: 38px; height: 38px; background-color: #538d4e; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">P</div>
                <div style="width: 38px; height: 38px; background-color: #538d4e; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">R</div>
                <div style="width: 38px; height: 38px; background-color: #538d4e; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">O</div>
                <div style="width: 38px; height: 38px; background-color: #538d4e; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">S</div>
                <div style="width: 38px; height: 38px; background-color: #538d4e; color: #ffffff; line-height: 38px; font-size: 18px; font-weight: bold; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">E</div>
              </div>
            </div>
            
            <!-- Direct Giphy CDN GIF -->
            <img src="https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHBhNmh2dGJ4OTIwcDcxNXl2dzBicmxtdnl3YThmZDFwcnN6YXRmNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/a0hZ41O8X5cME/giphy.gif" alt="Solving Wordle Puzzle" width="280" style="display: block; margin: 0 auto; max-width: 100%; height: auto; border-radius: 12px; border: 1px solid #1f2937; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);" />
            <span style="display: block; font-size: 11px; color: #4b5563; margin-top: 8px;">Solving animation — each day brings a fresh word puzzle</span>
          </div>
        </div>

        <div style="margin: 24px 0; background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 16px; padding: 20px;">
          <h3 style="color: #6366f1; font-size: 16px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em; font-family: sans-serif;">🔥 Challenges</h3>
          <p style="margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #9ca3af;">Create or join custom challenges with friends or the community. Every detail is configurable:</p>
          <ul style="color: #9ca3af; font-size: 14px; padding-left: 20px; line-height: 1.6; margin: 0 0 12px 0;">
            <li><strong>Word Length:</strong> 3 to 10 letters, or let the game pick randomly.</li>
            <li><strong>Attempts & Time:</strong> Set your own max attempts and time limits per round.</li>
            <li><strong>Marathon Mode:</strong> Solve a sequence of words (3 → 4 → 5 → 6 → 7 letters) in a single session.</li>
            <li><strong>Custom Words:</strong> Create your own word for friends to guess.</li>
            <li><strong>Shapeshifter Mode:</strong> The word changes after every guess. 20 attempts to adapt.</li>
          </ul>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #9ca3af;">Compete head-to-head on the exact same target and see who solves it faster and with fewer guesses. With real-time live matches and async play, there is always a challenge waiting.</p>
        </div>

        <div style="margin: 24px 0; background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 16px; padding: 20px;">
          <h3 style="color: #6366f1; font-size: 16px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em; font-family: sans-serif;">⚔️ WordUp Battles</h3>
          <p style="margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #9ca3af;">Real-time head-to-head trivia battles! Face off against opponents or bots across 7 rounds of questions spanning English, maths, and general knowledge.</p>
          <ul style="color: #9ca3af; font-size: 14px; padding-left: 20px; line-height: 1.6; margin: 0;">
            <li><strong>Matchmaking & Invites:</strong> Queue for a random opponent or challenge a friend directly.</li>
            <li><strong>ELO Rating System:</strong> Climb the ranks from Bronze → Silver → Gold → Diamond → Master.</li>
            <li><strong>XP & Rewards:</strong> Earn XP for each match, with bonus rewards for winning streaks.</li>
          </ul>
        </div>

        <div style="margin: 24px 0; background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 16px; padding: 20px;">
          <h3 style="color: #6366f1; font-size: 16px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em; font-family: sans-serif;">📊 Scoring & Leaderboards</h3>
          <p style="margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #9ca3af;">Compete for top spots across daily puzzles, challenges, and WordUp battle rankings. Every game mode feeds into your profile stats.</p>
          <ul style="color: #9ca3af; font-size: 14px; padding-left: 20px; line-height: 1.6; margin: 0;">
            <li><strong>Daily & Weekly Leaderboards:</strong> Points awarded based on speed and guesses. Top players earn bragging rights.</li>
            <li><strong>Streaks:</strong> Keep your winning streak alive to earn streak bonuses. Play before midnight to save it.</li>
            <li><strong>Challenge Rankings:</strong> See how you stack up in your custom challenge groups and marathon events.</li>
          </ul>
        </div>

        <div style="margin: 32px 0 16px 0; text-align: center;">
          <a href="${APP_URL}" class="btn-primary">Start Playing Now</a>
        </div>
      `;

         const html = getEmailHtml(
            targetUsername,
            targetUserId,
            "Welcome to variant! 🧩",
            content,
         );

         const success = await sendEmailWithFallback(
            targetEmail,
            "Welcome to variant! 🧩",
            html,
         );
         if (success) {
            sentCount++;
            log(`Successfully sent welcome email to ${targetEmail}`);
         } else {
            log(`Failed to send welcome email to ${targetEmail}`);
         }

         // Send copy to cemuchay@gmail.com with logs appended
         const fellowHtml = appendLogsToHtml(html, logs);
         log(`Sending fellow copy to cemuchay@gmail.com...`);
         await sendEmailWithFallback(
            "cemuchay@gmail.com",
            `[Fellow Copy] [To: ${targetEmail}] Welcome to variant! 🧩`,
            fellowHtml,
         );

         return new Response(
            JSON.stringify({ success: true, action, emails_sent: sentCount }),
            {
               headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
         );
      }

      // ACTION: MORNING REMINDERS
      if (action === "morning-reminders") {
         log(`Starting action morning-reminders`);
         // A. Fetch skipped day recipients
         log(`Fetching skipped day recipients from DB...`);
         const { data: skippedRecipients, error: skippedErr } =
            await supabase.rpc("get_skipped_day_recipients");
         if (skippedErr) {
            log(`Error fetching skipped day recipients: ${skippedErr.message}`);
            throw skippedErr;
         }
         log(`Found ${skippedRecipients?.length || 0} skipped day recipients.`);
         if (skippedRecipients && skippedRecipients.length > 0) {
            skippedRecipients.forEach((recipient: any) => {
               log(
                  `Eligible skipped day: ${recipient.username} (${recipient.email})`,
               );
            });
         }

         // B. Fetch 3-day inactive recipients (on Mondays)
         const lagosDay = new Intl.DateTimeFormat("en-US", {
            timeZone: "Africa/Lagos",
            weekday: "long",
         }).format(new Date());
         const isMonday = lagosDay.startsWith("Monday");
         log(`Lagos day of week: ${lagosDay}. isMonday: ${isMonday}`);

         let inactiveRecipients: any[] = [];
         if (isMonday) {
            log(`Fetching 3-day inactive recipients from DB...`);
            const { data, error: inactiveErr } = await supabase.rpc(
               "get_three_day_inactive_recipients",
            );
            if (inactiveErr) {
               log(
                  `Error fetching 3-day inactive recipients: ${inactiveErr.message}`,
               );
               throw inactiveErr;
            }
            inactiveRecipients = data || [];
            log(`Found ${inactiveRecipients.length} inactive recipients.`);
            inactiveRecipients.forEach((recipient: any) => {
               log(
                  `Eligible inactive: ${recipient.username} (${recipient.email})`,
               );
            });
         }

         // Send morning reminders to skipped day recipients
         if (skippedRecipients && skippedRecipients.length > 0) {
            for (const recipient of skippedRecipients) {
               const content = `
            <p>You skipped playing yesterday! Don't let your daily variant momentum slip away.</p>
            <p>Challenge yourself, stay sharp, and maintain your standing by playing today's puzzle right now!</p>
            <div style="margin: 32px 0 16px 0; text-align: center;">
              <a href="${APP_URL}" class="btn-primary">Resume Play Now</a>
            </div>
          `;
               const html = getEmailHtml(
                  recipient.username,
                  recipient.user_id,
                  "Resume your play today! ⚡",
                  content,
               );

               log(
                  `Attempting to send email to user ${recipient.username} (${recipient.email})...`,
               );
               const success = await sendEmailWithFallback(
                  recipient.email,
                  "Resume your play today! ⚡",
                  html,
               );
               if (success) {
                  sentCount++;
                  log(`Successfully sent email to ${recipient.email}`);
               } else {
                  log(`Failed to send email to ${recipient.email}`);
               }
            }
         }

         // Send morning reminders to inactive recipients
         if (inactiveRecipients.length > 0) {
            for (const recipient of inactiveRecipients) {
               const content = `
            <p>It's been at least 3 days since you last logged in to play variant.</p>
            <p>The weekly leaderboard is already heating up! Jump back in, crack today's word, and start climbing the ranks.</p>
            <div style="margin: 32px 0 16px 0; text-align: center;">
              <a href="${APP_URL}" class="btn-primary">Rejoin Leaderboard</a>
            </div>
          `;
               const html = getEmailHtml(
                  recipient.username,
                  recipient.user_id,
                  "The Leaderboard Misses You! 🧩",
                  content,
               );

               log(
                  `Attempting to send inactive reminder to user ${recipient.username} (${recipient.email})...`,
               );
               const success = await sendEmailWithFallback(
                  recipient.email,
                  "The Leaderboard Misses You! 🧩",
                  html,
               );
               if (success) {
                  sentCount++;
                  log(
                     `Successfully sent inactive reminder to ${recipient.email}`,
                  );
               } else {
                  log(`Failed to send inactive reminder to ${recipient.email}`);
               }
            }
         }

         if (sentCount === 0) {
            log(`No email reminders were sent to any users.`);
            const logsHtml = getLogsOnlyHtml("morning-reminders", logs);
            log(`Sending execution logs email to cemuchay@gmail.com...`);
            await sendEmailWithFallback(
               "cemuchay@gmail.com",
               `[Logs] morning-reminders - No recipients eligible`,
               logsHtml,
            );
         } else {
            log(
               `Finished morning-reminders processing. Total user emails sent: ${sentCount}`,
            );
         }

         return new Response(
            JSON.stringify({ success: true, action, emails_sent: sentCount }),
            {
               headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
         );
      }

      // ACTION: EVENING REMINDERS (Streak Warnings)
      if (action === "evening-reminders") {
         log(`Starting action evening-reminders`);
         log(`Fetching streak warning recipients from DB...`);
         const { data: recipients, error: err } = await supabase.rpc(
            "get_streak_warning_recipients",
         );
         if (err) {
            log(`Error fetching streak warning recipients: ${err.message}`);
            throw err;
         }
         log(`Found ${recipients?.length || 0} streak warning recipients.`);
         if (recipients && recipients.length > 0) {
            recipients.forEach((recipient: any) => {
               log(
                  `Eligible streak warning: ${recipient.username} (${recipient.email}, Current Streak: ${recipient.current_streak})`,
               );
            });

            for (const recipient of recipients) {
               const content = `
            <p>You have an active <strong>${recipient.current_streak}-day winning streak</strong> but haven't played today yet!</p>
            <p>It is already past 7:00 PM WAT. Don't let all your hard work go to waste—solve today's Word before midnight to keep your streak alive!</p>
            <div style="margin: 32px 0 16px 0; text-align: center;">
              <a href="${APP_URL}" class="btn-primary">Save My Streak</a>
            </div>
          `;
               const html = getEmailHtml(
                  recipient.username,
                  recipient.user_id,
                  "⚠️ Streak Warning!",
                  content,
               );
               const subject = `⚠️ Streak Warning: Save your ${recipient.current_streak}-day streak!`;

               log(
                  `Attempting to send streak warning email to user ${recipient.username} (${recipient.email})...`,
               );
               const success = await sendEmailWithFallback(
                  recipient.email,
                  subject,
                  html,
               );
               if (success) {
                  sentCount++;
                  log(`Successfully sent email to ${recipient.email}`);
               } else {
                  log(`Failed to send email to ${recipient.email}`);
               }
            }
         }

         if (sentCount === 0) {
            log(`No streak warning emails were sent to any users.`);
            const logsHtml = getLogsOnlyHtml("evening-reminders", logs);
            log(`Sending execution logs email to cemuchay@gmail.com...`);
            await sendEmailWithFallback(
               "cemuchay@gmail.com",
               `[Logs] evening-reminders - No recipients eligible`,
               logsHtml,
            );
         } else {
            log(
               `Finished evening-reminders processing. Total user emails sent: ${sentCount}`,
            );
         }

         return new Response(
            JSON.stringify({ success: true, action, emails_sent: sentCount }),
            {
               headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
         );
      }

      // ACTION: WEEKLY REPORT
      if (action === "weekly-report") {
         log(`Starting action weekly-report`);
         // 1. Fetch Leaderboard for previous week
         log(`Fetching weekly report leaderboard from DB...`);
         const { data: leaderboard, error: lbErr } = await supabase.rpc(
            "get_weekly_report_leaderboard",
         );
         if (lbErr) {
            log(`Error fetching leaderboard: ${lbErr.message}`);
            throw lbErr;
         }
         log(`Leaderboard size: ${leaderboard?.length || 0}`);

         // 2. Fetch Weekly Report recipients (played at least 1 game last week)
         log(`Fetching weekly report recipients from DB...`);
         const { data: recipients, error: recErr } = await supabase.rpc(
            "get_weekly_report_recipients",
         );
         if (recErr) {
            log(`Error fetching weekly report recipients: ${recErr.message}`);
            throw recErr;
         }
         log(`Found ${recipients?.length || 0} weekly report recipients.`);
         if (recipients && recipients.length > 0) {
            recipients.forEach((recipient: any) => {
               log(
                  `Eligible weekly report recipient: ${recipient.username} (${recipient.email})`,
               );
            });
         }

         if (
            recipients &&
            recipients.length > 0 &&
            leaderboard &&
            leaderboard.length > 0
         ) {
            for (const recipient of recipients) {
               // Find player's standing
               const myIndex = leaderboard.findIndex(
                  (entry: any) => entry.username === recipient.username,
               );
               const myRank = myIndex !== -1 ? myIndex + 1 : null;
               const myPoints =
                  myIndex !== -1 ? leaderboard[myIndex].total_points : 0;
               const myDaysActive =
                  myIndex !== -1 ? leaderboard[myIndex].days_active : 0;

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

               relativeLeaderboard.forEach((entry: any) => {
                  const globalIdx = leaderboard.findIndex(
                     (e: any) => e.username === entry.username,
                  );
                  const rank = globalIdx + 1;
                  const isMe = entry.username === recipient.username;

                  const rankColor =
                     rank === 1
                        ? "#fbbf24"
                        : rank === 2
                          ? "#d1d5db"
                          : rank === 3
                            ? "#b45309"
                            : "#ffffff";
                  const rankLabel =
                     rank === 1
                        ? "🥇"
                        : rank === 2
                          ? "🥈"
                          : rank === 3
                            ? "🥉"
                            : `#${rank}`;

                  const rowStyle = isMe
                     ? "background-color: #1e1b4b; border-left: 4px solid #6366f1;"
                     : "border-bottom: 1px solid #1f2937;";
                  const textStyle = isMe
                     ? "font-weight: 800; color: #a5b4fc;"
                     : "color: #ffffff;";

                  const avatarSrc = getAvatarUrl(
                     entry.avatar_url,
                     entry.username,
                  );

                  tableRowsHtml += `
              <tr style="${rowStyle}">
                <td style="padding: 12px 8px; font-weight: 800; color: ${rankColor};">${rankLabel}</td>
                <td style="padding: 12px 8px; font-weight: bold; ${textStyle}">
                  <img src="${avatarSrc}" alt="" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid #374151; vertical-align: middle; margin-right: 8px; background-color: #1f2937;" />
                  <span style="vertical-align: middle;">${formatUsername(entry.username)}${isMe ? " (You)" : ""}</span>
                </td>
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

               const html = getEmailHtml(
                  recipient.username,
                  recipient.user_id,
                  "Your Weekly Report 📊",
                  content,
               );
               const subject = "Your variant Weekly Report 📊";

               log(
                  `Attempting to send weekly report email to user ${recipient.username} (${recipient.email})...`,
               );
               const success = await sendEmailWithFallback(
                  recipient.email,
                  subject,
                  html,
               );
               if (success) {
                  sentCount++;
                  log(`Successfully sent email to ${recipient.email}`);
               } else {
                  log(`Failed to send email to ${recipient.email}`);
               }
            }
         }

         if (sentCount === 0) {
            log(`No weekly report emails were sent to any users.`);
            const logsHtml = getLogsOnlyHtml("weekly-report", logs);
            log(`Sending execution logs email to cemuchay@gmail.com...`);
            await sendEmailWithFallback(
               "cemuchay@gmail.com",
               `[Logs] weekly-report - No recipients eligible`,
               logsHtml,
            );
         } else {
            log(
               `Finished weekly-report processing. Total user emails sent: ${sentCount}`,
            );
         }

         return new Response(
            JSON.stringify({ success: true, action, emails_sent: sentCount }),
            {
               headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
         );
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
         status: 400,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
   } catch (error) {
      log(
         `[ERROR] Fatal execution failure in action "${action}": ${(error as any).message}`,
      );
      try {
         // Attempt to send logs to developer to alert about the failure
         const logsHtml = getLogsOnlyHtml(action, logs);
         await sendEmailWithFallback(
            "cemuchay@gmail.com",
            `[Logs/Error] ${action} execution failed`,
            logsHtml,
         );
      } catch (sendErr) {
         console.error(
            "Failed to send error logs to developer:",
            (sendErr as any).message,
         );
      }
      return new Response(JSON.stringify({ error: (error as any).message }), {
         status: 500,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
   }
});
