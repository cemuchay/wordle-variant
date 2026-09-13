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
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,700;0,6..72,800;1,6..72,400&family=Playfair+Display:wght@700;800;900&family=Source+Sans+3:wght@400;600;700;900&display=swap" rel="stylesheet">
        <style>
          body {
            background-color: #030712;
            color: #f1f5f9;
            font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 36px 16px;
          }
          .card {
            background: linear-gradient(180deg, #0f172a 0%, #090d16 100%);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 20px;
            padding: 36px 28px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
          }
          .rainbow-bar {
            background: linear-gradient(90deg, #f43f5e 0%, #f59e0b 20%, #10b981 40%, #06b6d4 60%, #6366f1 80%, #a855f7 100%);
            height: 4px;
            border-radius: 9999px;
            margin-bottom: 24px;
          }
          .brand-tag {
            display: inline-block;
            font-family: 'Source Sans 3', sans-serif;
            background: linear-gradient(90deg, rgba(244, 63, 94, 0.12), rgba(99, 102, 241, 0.12));
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #94a3b8;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            padding: 4px 12px;
            border-radius: 6px;
            margin-bottom: 16px;
          }
          /* WSJ / Morning Brew Editorial Headlines */
          h1 {
            font-family: 'Newsreader', 'Playfair Display', Georgia, 'Times New Roman', serif;
            color: #ffffff;
            font-size: 28px;
            font-weight: 800;
            margin-top: 0;
            margin-bottom: 16px;
            letter-spacing: -0.015em;
            line-height: 1.2;
          }
          h2, h3 {
            font-family: 'Newsreader', 'Playfair Display', Georgia, serif;
          }
          p {
            font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #cbd5e1;
            font-size: 16px;
            line-height: 1.65;
            margin-top: 0;
            margin-bottom: 20px;
          }
          .greeting {
            font-family: 'Source Sans 3', sans-serif;
            font-size: 16px;
            font-weight: 600;
            color: #f8fafc;
            margin-bottom: 18px;
          }
          .btn-primary {
            display: inline-block;
            font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
            color: #ffffff !important;
            font-size: 13px;
            font-weight: 900;
            text-decoration: none;
            padding: 14px 34px;
            border-radius: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.45);
            text-align: center;
          }
          .footer {
            margin-top: 36px;
            text-align: center;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding-top: 24px;
          }
          .footer-text {
            font-family: 'Source Sans 3', sans-serif;
            color: #64748b;
            font-size: 12px;
            line-height: 1.55;
            margin: 0;
          }
          .footer-link {
            color: #818cf8;
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
            <div class="rainbow-bar"></div>
            <div class="brand-tag">THE DAILY VARIANT • ISSUE BRIEFING</div>
            <h1>${title}</h1>
            <p class="greeting">Good morning, <strong>${formatUsername(username)}</strong> —</p>
            ${contentHtml}
            <div class="footer">
              <p class="footer-text">
                Sent with ❤️ from <strong>wordle-variant.xyz</strong>. To opt out anytime, you can 
                <a href="${unsubscribeUrl}" class="footer-link">manage preferences or unsubscribe</a>.
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

// Helper to query telemetry summary and send findings report to cemuchay@gmail.com
const sendDailyTelemetryReport = async (
   supabase: any,
   sendEmailWithFallback: (to: string, subject: string, html: string) => Promise<boolean>,
   log: (msg: string) => void,
) => {
   try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const targetDate = yesterday.toISOString().split("T")[0];

      log(`Fetching daily telemetry summary for ${targetDate}...`);
      const { data, error } = await supabase.rpc("get_daily_telemetry_summary", {
         p_target_date: targetDate,
      });

      if (error) {
         log(`Error fetching telemetry summary: ${error.message}`);
         return false;
      }

      const summary = data?.[0] || {};
      const activeDevices = summary.total_active_devices || 0;
      const appOpens = summary.total_app_opens || 0;
      const avgOpens = summary.avg_app_opens_per_user || 0;
      const avgTimeSec = summary.avg_time_spent_seconds || 0;
      const bounceRate = summary.bounce_rate_pct || 0;
      const topClicksMap = summary.top_clicks || {};
      const topTimeMap = summary.top_time_spent || {};

      const formatDuration = (totalSec: number) => {
         const m = Math.floor(totalSec / 60);
         const s = totalSec % 60;
         return `${m}m ${s}s`;
      };

      const topClicksEntries = Object.entries(topClicksMap)
         .sort((a: any, b: any) => b[1] - a[1])
         .slice(0, 5);
      const topClicksHtml = topClicksEntries.length > 0
         ? topClicksEntries
            .map(([section, count]) => `
               <li style="margin-bottom: 6px; color: #f3f4f6;">
                  <strong style="color: #6366f1;">${section}</strong>: ${count} clicks
               </li>
            `).join("")
         : `<li style="color: #9ca3af;">No clicks recorded.</li>`;

      const topTimeEntries = Object.entries(topTimeMap)
         .sort((a: any, b: any) => b[1] - a[1])
         .slice(0, 5);
      const topTimeHtml = topTimeEntries.length > 0
         ? topTimeEntries
            .map(([section, sec]: any) => `
               <li style="margin-bottom: 6px; color: #f3f4f6;">
                  <strong style="color: #10b981;">${section}</strong>: ${formatDuration(sec)}
               </li>
            `).join("")
         : `<li style="color: #9ca3af;">No active time recorded.</li>`;

      const content = `
         <p>Here is yesterday's anonymized telemetry findings report for <strong>${targetDate}</strong>:</p>

         <div style="margin: 20px 0; background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 16px; padding: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
               <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #1f2937; color: #9ca3af; font-[12px]; text-transform: uppercase;">Active Devices</td>
                  <td style="padding: 10px; border-bottom: 1px solid #1f2937; color: #6366f1; font-weight: bold; font-size: 16px; text-align: right;">${activeDevices}</td>
               </tr>
               <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #1f2937; color: #9ca3af; font-[12px]; text-transform: uppercase;">App Opens</td>
                  <td style="padding: 10px; border-bottom: 1px solid #1f2937; color: #10b981; font-weight: bold; font-size: 16px; text-align: right;">${appOpens} (${avgOpens}/user)</td>
               </tr>
               <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #1f2937; color: #9ca3af; font-[12px]; text-transform: uppercase;">Avg Time Spent</td>
                  <td style="padding: 10px; border-bottom: 1px solid #1f2937; color: #f59e0b; font-weight: bold; font-size: 16px; text-align: right;">${formatDuration(Math.round(avgTimeSec))}</td>
               </tr>
               <tr>
                  <td style="padding: 10px; color: #9ca3af; font-[12px]; text-transform: uppercase;">Bounce Rate</td>
                  <td style="padding: 10px; color: #ef4444; font-weight: bold; font-size: 16px; text-align: right;">${bounceRate}%</td>
               </tr>
            </table>
         </div>

         <div style="margin: 20px 0; background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 16px; padding: 20px;">
            <h3 style="color: #6366f1; font-size: 14px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase;">🔥 Most Clicked Sections / Modals</h3>
            <ul style="padding-left: 20px; margin: 0; font-size: 14px; line-height: 1.6;">
               ${topClicksHtml}
            </ul>
         </div>

         <div style="margin: 20px 0; background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 16px; padding: 20px;">
            <h3 style="color: #10b981; font-size: 14px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase;">⏱️ Most Time Spent per Section</h3>
            <ul style="padding-left: 20px; margin: 0; font-size: 14px; line-height: 1.6;">
               ${topTimeHtml}
            </ul>
         </div>

         <div style="margin: 28px 0 12px 0; text-align: center;">
            <a href="${APP_URL}/admin" class="btn-primary">Open Admin Dashboard</a>
         </div>
      `;

      const html = getEmailHtml("Admin", "admin", `📊 Daily Telemetry Digest [${targetDate}]`, content);
      await sendEmailWithFallback("cemuchay@gmail.com", `📊 Daily Telemetry Report (${targetDate})`, html);
      log(`Successfully dispatched telemetry digest for ${targetDate} to cemuchay@gmail.com`);
      return true;
   } catch (err: any) {
      log(`Failed to generate telemetry report email: ${err?.message || err}`);
      return false;
   }
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
            <div style="background: linear-gradient(135deg, rgba(244, 63, 94, 0.12), rgba(245, 158, 11, 0.12)); border: 1px solid rgba(244, 63, 94, 0.25); border-radius: 18px; padding: 20px; margin-bottom: 24px; text-align: center;">
               <div style="font-size: 32px; margin-bottom: 8px;">🔥</div>
               <h3 style="margin: 0 0 6px 0; color: #ffffff; font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em;">Your Streak Needs You!</h3>
               <p style="margin: 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;">You missed yesterday's puzzle, but today is a fresh opportunity to stay sharp and climb the leaderboard.</p>
            </div>
            <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center;">
               Today's word is live with fresh clues and high stakes. It only takes 3 minutes to test your vocabulary and defend your rank!
            </p>
            <div style="margin: 32px 0 16px 0; text-align: center;">
              <a href="${APP_URL}" class="btn-primary">Crack Today's Word ⚡</a>
            </div>
          `;
               const html = getEmailHtml(
                  recipient.username,
                  recipient.user_id,
                  "Your Daily Puzzle Awaits! ⚡",
                  content,
               );

               log(
                  `Attempting to send email to user ${recipient.username} (${recipient.email})...`,
               );
               const success = await sendEmailWithFallback(
                  recipient.email,
                  "Your Daily Puzzle Awaits! ⚡",
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
            <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12)); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 18px; padding: 20px; margin-bottom: 24px; text-align: center;">
               <div style="font-size: 32px; margin-bottom: 8px;">🏆</div>
               <h3 style="margin: 0 0 6px 0; color: #ffffff; font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em;">The Arena Misses You!</h3>
               <p style="margin: 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;">It's been a few days since your last solve. The global leaderboard is heating up, and your rivals are making moves.</p>
            </div>
            <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center;">
               Jump back in this morning to test your skills, reclaim your standing, and claim your share of weekly trophies!
            </p>
            <div style="margin: 32px 0 16px 0; text-align: center;">
              <a href="${APP_URL}" class="btn-primary">Jump Back In & Solve 🚀</a>
            </div>
          `;
               const html = getEmailHtml(
                  recipient.username,
                  recipient.user_id,
                  "Reclaim Your Rank on the Leaderboard! 🧩",
                  content,
               );

               log(
                  `Attempting to send inactive reminder to user ${recipient.username} (${recipient.email})...`,
               );
               const success = await sendEmailWithFallback(
                  recipient.email,
                  "Reclaim Your Rank on the Leaderboard! 🧩",
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

         // Send daily telemetry digest report in parallel to cemuchay@gmail.com
         log(`Triggering parallel daily telemetry digest email to cemuchay@gmail.com...`);
         sendDailyTelemetryReport(supabase, sendEmailWithFallback, log).catch((err) => {
            log(`Error in parallel telemetry digest: ${err?.message || err}`);
         });

         return new Response(
            JSON.stringify({ success: true, action, emails_sent: sentCount }),
            {
               headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
         );
      }

      // ACTION: DAILY TELEMETRY DIGEST (Standalone endpoint)
      if (action === "daily-telemetry-digest") {
         log(`Starting action daily-telemetry-digest`);
         await sendDailyTelemetryReport(supabase, sendEmailWithFallback, log);
         return new Response(
            JSON.stringify({ success: true, action }),
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

         // Compute previous ISO week key for awards lookup
         const prevMonday = new Date();
         const dayOfWeek = (prevMonday.getDay() + 6) % 7;
         prevMonday.setDate(prevMonday.getDate() - dayOfWeek - 7);
         const isoYear = prevMonday.getFullYear();
         const startOfYear = new Date(isoYear, 0, 1);
         const diffDays = Math.floor((prevMonday.getTime() - startOfYear.getTime()) / 86400000);
         const weekNum = Math.ceil((diffDays + startOfYear.getDay() + 1) / 7);
         const prevWeekKey = `${isoYear}-W${String(weekNum).padStart(2, '0')}`;

         // Fetch weekly awards
         const { data: weeklyAwards } = await supabase
            .from("user_awards")
            .select("user_id, award_type, score")
            .eq("period_key", prevWeekKey);
         const winnerMap: Record<string, { weekly_champion?: number; bot_marathon_weekly?: number }> = {};
         if (weeklyAwards) {
            for (const award of weeklyAwards) {
               if (!winnerMap[award.user_id]) winnerMap[award.user_id] = {};
               winnerMap[award.user_id][award.award_type] = award.score;
            }
         }

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
                  const entryAwards = winnerMap[entry.user_id];
                  let awardIcons = "";
                  if (entryAwards) {
                     if (entryAwards.weekly_champion) awardIcons += "🥇";
                     if (entryAwards.bot_marathon_weekly) awardIcons += "🤖";
                  }

                  const rankColor =
                     rank === 1
                        ? "#f59e0b"
                        : rank === 2
                          ? "#94a3b8"
                          : rank === 3
                            ? "#d97706"
                            : "#a1a1aa";
                  const rankBadgeBg =
                     rank === 1
                        ? "rgba(245, 158, 11, 0.18)"
                        : rank === 2
                          ? "rgba(148, 163, 184, 0.15)"
                          : rank === 3
                            ? "rgba(217, 119, 6, 0.15)"
                            : "rgba(255, 255, 255, 0.05)";
                  const rankLabel =
                     rank === 1
                        ? "🥇 #1"
                        : rank === 2
                          ? "🥈 #2"
                          : rank === 3
                            ? "🥉 #3"
                            : `#${rank}`;

                  const rowStyle = isMe
                     ? "background: linear-gradient(90deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.15)); border-left: 4px solid #8b5cf6;"
                     : "border-bottom: 1px solid rgba(255, 255, 255, 0.06);";
                  const textStyle = isMe
                     ? "font-weight: 800; color: #c7d2fe;"
                     : "color: #f1f5f9;";

                  const avatarSrc = getAvatarUrl(
                     entry.avatar_url,
                     entry.username,
                  );

                  tableRowsHtml += `
               <tr style="${rowStyle}">
                 <td style="padding: 12px 10px; font-weight: 900; font-size: 12px; white-space: nowrap;">
                   <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; background-color: ${rankBadgeBg}; color: ${rankColor};">${rankLabel}</span>
                 </td>
                 <td style="padding: 12px 10px; font-weight: 800; font-size: 13px; white-space: nowrap; ${textStyle}">
                   <img src="${avatarSrc}" alt="" style="width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.2); vertical-align: middle; margin-right: 8px; background-color: #1e293b;" />
                   <span style="vertical-align: middle;">${formatUsername(entry.username)}${isMe ? ' <span style="background: #6366f1; color: #ffffff; font-size: 9px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; margin-left: 4px;">YOU</span>' : ""}</span>
                   ${awardIcons ? `<span style="margin-left: 4px; font-size: 13px; vertical-align: middle;">${awardIcons}</span>` : ''}
                 </td>
                 <td style="padding: 12px 10px; text-align: right; font-weight: 900; font-size: 14px; color: #38bdf8; white-space: nowrap;">${entry.total_points.toLocaleString()}</td>
                 <td style="padding: 12px 10px; text-align: right; color: #94a3b8; font-size: 12px; font-weight: 700; white-space: nowrap;">${entry.days_active}/7d</td>
               </tr>
             `;
               });

               const leaderboardTableHtml = `
            <div style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 20px 0; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; background-color: #0b0f19;">
              <table style="width: 100%; min-width: 480px; border-collapse: collapse;">
                <thead>
                  <tr style="background: linear-gradient(90deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9)); border-bottom: 2px solid rgba(255, 255, 255, 0.1);">
                    <th style="padding: 12px 10px; text-align: left; font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Rank</th>
                    <th style="padding: 12px 10px; text-align: left; font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Player</th>
                    <th style="padding: 12px 10px; text-align: right; font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Points</th>
                    <th style="padding: 12px 10px; text-align: right; font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">Puzzles</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHtml}
                </tbody>
              </table>
            </div>
          `;

               let statsSummaryHtml = "";
               if (myRank) {
                  let awardBadgesHtml = "";
                  const recipientAwards = winnerMap[recipient.user_id];
                  if (recipientAwards) {
                     if (recipientAwards.weekly_champion) {
                        awardBadgesHtml += `<div style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #ec4899); color: #ffffff; font-weight: 900; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; padding: 6px 16px; border-radius: 9999px; margin: 4px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">👑 Weekly Champion</div>`;
                     }
                     if (recipientAwards.bot_marathon_weekly) {
                        awardBadgesHtml += `<div style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #10b981); color: #ffffff; font-weight: 900; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; padding: 6px 16px; border-radius: 9999px; margin: 4px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">🤖 Bot Marathon Champ</div>`;
                     }
                  }
                  statsSummaryHtml = `
              <div style="background: linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%); border: 1px solid rgba(139, 92, 246, 0.35); border-radius: 20px; padding: 22px 16px; margin: 24px 0; text-align: center; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);">
                ${awardBadgesHtml ? `<div style="margin-bottom: 14px; display: flex; justify-content: center; gap: 6px; flex-wrap: wrap;">${awardBadgesHtml}</div>` : ''}
                <div style="display: inline-block; background: linear-gradient(90deg, #f43f5e, #f59e0b, #10b981, #06b6d4, #8b5cf6); -webkit-background-clip: text; color: #a5b4fc; font-size: 11px; text-transform: uppercase; font-weight: 900; letter-spacing: 0.1em; margin-bottom: 12px;">★ Your Weekly Snapshot ★</div>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 4px;">
                  <tr>
                    <td style="text-align: center; padding: 8px; width: 33%;">
                      <span style="display: block; font-size: 26px; font-weight: 900; color: #fbbf24; text-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);">#${myRank}</span>
                      <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em;">Global Rank</span>
                    </td>
                    <td style="text-align: center; padding: 8px; width: 33%; border-left: 1px solid rgba(255,255,255,0.1); border-right: 1px solid rgba(255,255,255,0.1);">
                      <span style="display: block; font-size: 26px; font-weight: 900; color: #38bdf8; text-shadow: 0 2px 8px rgba(56, 189, 248, 0.3);">${myPoints.toLocaleString()}</span>
                      <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em;">Skill Points</span>
                    </td>
                    <td style="text-align: center; padding: 8px; width: 33%;">
                      <span style="display: block; font-size: 26px; font-weight: 900; color: #34d399; text-shadow: 0 2px 8px rgba(52, 211, 153, 0.3);">${myDaysActive}/7</span>
                      <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em;">Days Active</span>
                    </td>
                  </tr>
                </table>
              </div>
            `;
               }

               const content = `
            <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6;">
               Another thrilling week of word battles is in the books! Check out how you stacked up against the competition from Monday to Sunday:
            </p>
            ${statsSummaryHtml}
            <div style="display: flex; align-items: center; justify-content: space-between; margin: 24px 0 10px 0;">
              <h3 style="color: #ffffff; font-size: 15px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -0.01em;">Leaderboard Standing (Your Window)</h3>
              <span style="color: #64748b; font-size: 11px; font-weight: 700;">Swipe &rarr; on mobile</span>
            </div>
            ${leaderboardTableHtml}
            <div style="margin: 32px 0 16px 0; text-align: center;">
              <a href="${APP_URL}" class="btn-primary">View Full Leaderboard & Play 🧩</a>
            </div>
          `;

               const html = getEmailHtml(
                  recipient.username,
                  recipient.user_id,
                  "Your Weekly Wordle Recap 📊",
                  content,
               );
               const subject = "Your Weekly Wordle Recap & Standings 📊";

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

      // ACTION: BOT MARATHON NEW EVENT
      if (action === "bot-marathon-new-event") {
         log(`Starting action bot-marathon-new-event`);
         const challengeId = body.challenge_id;
         const targetUrl = `${APP_URL}/?challenge=${challengeId || ""}`;

         // Fetch active users without push subscriptions
         const { data: recipients, error } = await supabase.rpc("get_active_users_for_bot_marathon");
         if (error) throw error;

         const emailEligible = (recipients || []).filter((r: any) => !r.has_push_sub && r.receive_emails);
         log(`Found ${emailEligible.length} active users eligible for bot marathon email notification.`);

         for (const r of emailEligible) {
            const content = `
               <p>A brand new <strong>Daily Bot Marathon Event</strong> has just been created!</p>
               <p>Compete against <strong>Variant Bot</strong> and players worldwide across sequential 3 to 7-letter word puzzles. Prove your word skills and claim top standing on the leaderboard!</p>
               <div style="margin: 32px 0 16px 0; text-align: center;">
                 <a href="${targetUrl}" class="btn-primary">Join Bot Marathon Now</a>
               </div>
            `;
            const html = getEmailHtml(r.username, r.user_id, "🤖 New Daily Bot Marathon Event!", content);
            const success = await sendEmailWithFallback(r.email, "🤖 New Daily Bot Marathon Event! Compete Now", html);
            if (success) sentCount++;
         }

         return new Response(JSON.stringify({ success: true, action, emails_sent: sentCount }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
      }

      // ACTION: BOT MARATHON OVERTAKEN
      if (action === "bot-marathon-overtaken") {
         log(`Starting action bot-marathon-overtaken`);
         const targetEmail = body.email;
         const targetUsername = body.username || "Player";
         const targetUserId = body.user_id;
         const surpassedBy = body.surpassed_by || "Another player";
         const challengeId = body.challenge_id;
         const targetUrl = `${APP_URL}/?challenge=${challengeId || ""}`;

         if (targetEmail) {
            const content = `
               <p><strong>${formatUsername(surpassedBy)}</strong> just surpassed your score in the Daily Bot Marathon Event!</p>
               <p>Don't let them take your rank. Rejoin the challenge right now and push for a higher score!</p>
               <div style="margin: 32px 0 16px 0; text-align: center;">
                 <a href="${targetUrl}" class="btn-primary">Reclaim Your Rank</a>
               </div>
            `;
            const html = getEmailHtml(targetUsername, targetUserId, "⚠️ You've Been Passed!", content);
            const success = await sendEmailWithFallback(targetEmail, `⚠️ ${formatUsername(surpassedBy)} passed you in the Bot Marathon!`, html);
            if (success) sentCount++;
         }

         return new Response(JSON.stringify({ success: true, action, emails_sent: sentCount }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
      }

      // ACTION: BOT MARATHON GRAND FINALE
      if (action === "bot-marathon-grand-finale") {
         log(`Starting action bot-marathon-grand-finale`);
         const targetEmail = body.email;
         const targetUsername = body.username || "Player";
         const targetUserId = body.user_id;
         const challengeId = body.challenge_id;
         const targetUrl = `${APP_URL}/?challenge=${challengeId || ""}`;

         if (targetEmail) {
            const content = `
               <p>The <strong>Grand Finale</strong> for the Daily Bot Marathon Event is approaching!</p>
               <p>There are only <strong>24 hours remaining</strong> to complete your games and lock in your position on the leaderboard.</p>
               <div style="margin: 32px 0 16px 0; text-align: center;">
                 <a href="${targetUrl}" class="btn-primary">Play Final Rounds</a>
               </div>
            `;
            const html = getEmailHtml(targetUsername, targetUserId, "🔥 Bot Marathon Grand Finale Approaching!", content);
            const success = await sendEmailWithFallback(targetEmail, "🔥 24 Hours Left! Bot Marathon Grand Finale", html);
            if (success) sentCount++;
         }

         return new Response(JSON.stringify({ success: true, action, emails_sent: sentCount }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
      }

      // ACTION: ADMIN CUSTOM BROADCAST
      if (action === "admin-custom-broadcast") {
         log(`Starting action admin-custom-broadcast`);
         const targetEmail = body.email;
         const targetUsername = body.username || "Player";
         const targetUserId = body.user_id;
         const title = body.title || "Special Announcement";
         const message = body.message || "";
         const url = body.url || APP_URL;
         const targetUrl = url.startsWith("http") ? url : `${APP_URL}${url.startsWith("/") ? "" : "/"}${url}`;

         if (targetEmail) {
            const content = `
               <div style="margin-bottom: 24px;">
                 <p style="font-size: 15px; line-height: 1.6; color: #f3f4f6;">${message.replace(/\n/g, "<br>")}</p>
               </div>
               <div style="margin: 32px 0 16px 0; text-align: center;">
                 <a href="${targetUrl}" class="btn-primary">Open Variant</a>
               </div>
            `;
            const html = getEmailHtml(targetUsername, targetUserId, title, content);
            const success = await sendEmailWithFallback(targetEmail, title, html);
            if (success) sentCount++;
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
