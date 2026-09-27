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
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(formatUsername(username))}&background=111827&color=fff&size=128`;
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

// Clean, professional editorial light mode HTML email template wrapper (WSJ / NYT style)
const getEmailHtml = (
   username: string,
   userId: string,
   title: string,
   contentHtml: string,
) => {
   const unsubscribeUrl = `${APP_URL}/unsubscribe?user_id=${userId}`;
   return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,600;0,6..72,700;0,6..72,800;1,6..72,400&family=Playfair+Display:wght@700;800;900&family=Source+Sans+3:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          body {
            background-color: #f4f4f5;
            color: #18181b;
            font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 580px;
            margin: 0 auto;
            padding: 32px 16px;
          }
          .card {
            background-color: #ffffff;
            border: 1px solid #e4e4e7;
            border-radius: 8px;
            padding: 36px 32px;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
          }
          .masthead {
            border-bottom: 2px solid #18181b;
            padding-bottom: 14px;
            margin-bottom: 24px;
            text-align: center;
          }
          .masthead-title {
            font-family: 'Newsreader', 'Playfair Display', Georgia, 'Times New Roman', serif;
            font-size: 26px;
            font-weight: 800;
            letter-spacing: 0.08em;
            color: #18181b;
            text-transform: uppercase;
            margin: 0;
          }
          .masthead-subtitle {
            font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.18em;
            color: #71717a;
            text-transform: uppercase;
            margin-top: 4px;
          }
          h1 {
            font-family: 'Newsreader', 'Playfair Display', Georgia, 'Times New Roman', serif;
            color: #18181b;
            font-size: 24px;
            font-weight: 800;
            margin-top: 0;
            margin-bottom: 16px;
            line-height: 1.25;
            letter-spacing: -0.01em;
          }
          h2, h3 {
            font-family: 'Newsreader', 'Playfair Display', Georgia, serif;
            color: #18181b;
          }
          p {
            font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #3f3f46;
            font-size: 15px;
            line-height: 1.6;
            margin-top: 0;
            margin-bottom: 18px;
          }
          .greeting {
            font-family: 'Source Sans 3', sans-serif;
            font-size: 15px;
            font-weight: 600;
            color: #18181b;
            margin-bottom: 16px;
          }
          .btn-primary {
            display: inline-block;
            font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: #18181b;
            color: #ffffff !important;
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 6px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            text-align: center;
          }
          .btn-primary:hover {
            background-color: #27272a;
          }
          .section-box {
            background-color: #fafafa;
            border: 1px solid #e4e4e7;
            border-radius: 6px;
            padding: 18px 20px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 32px;
            text-align: center;
            border-top: 1px solid #e4e4e7;
            padding-top: 20px;
          }
          .footer-text {
            font-family: 'Source Sans 3', sans-serif;
            color: #71717a;
            font-size: 12px;
            line-height: 1.5;
            margin: 0;
          }
          .footer-link {
            color: #18181b;
            text-decoration: underline;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="masthead">
              <div class="masthead-title">THE VARIANT</div>
              <div class="masthead-subtitle">DAILY WORD PUZZLE & GAZETTE</div>
            </div>
            <h1>${title}</h1>
            <p class="greeting">Good morning, <strong>${formatUsername(username)}</strong> —</p>
            ${contentHtml}
            <div class="footer">
              <p class="footer-text">
                Sent from <strong>wordle-variant.xyz</strong>. To opt out anytime, you can 
                <a href="${unsubscribeUrl}" class="footer-link">manage preferences or unsubscribe</a>.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

// Helper to append logs to an email HTML template for developer eyes
const appendLogsToHtml = (originalHtml: string, logs: string[]) => {
   const logsBlock = `
    <div style="margin-top: 36px; border-top: 2px dashed #d4d4d8; padding-top: 20px;">
      <h3 style="color: #18181b; font-size: 13px; font-weight: 800; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.06em; font-family: sans-serif;">Execution Logs (Dev Only)</h3>
      <pre style="background-color: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 6px; padding: 14px; margin: 0; color: #047857; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; line-height: 1.5; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">${logs.join("\n")}</pre>
    </div>
  `;
   return originalHtml.replace("</body>", `${logsBlock}</body>`);
};

// Helper to get HTML body containing only execution logs
const getLogsOnlyHtml = (action: string, logs: string[]) => {
   const content = `
    <p>No email reminders were sent to any users for <strong>${action}</strong> because no users were eligible.</p>
    <div style="margin-top: 20px;">
      <h3 style="color: #18181b; font-size: 13px; font-weight: 800; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.06em; font-family: sans-serif;">Execution Logs</h3>
      <pre style="background-color: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 6px; padding: 14px; margin: 0; color: #047857; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; line-height: 1.5; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">${logs.join("\n")}</pre>
    </div>
  `;
   return getEmailHtml("Developer", "dev", `[Logs] ${action}`, content);
};

// Helper to query telemetry summary and send findings report
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
               <li style="margin-bottom: 6px; color: #3f3f46;">
                  <strong style="color: #18181b;">${section}</strong>: ${count} clicks
               </li>
            `).join("")
         : `<li style="color: #71717a;">No clicks recorded.</li>`;

      const topTimeEntries = Object.entries(topTimeMap)
         .sort((a: any, b: any) => b[1] - a[1])
         .slice(0, 5);
      const topTimeHtml = topTimeEntries.length > 0
         ? topTimeEntries
            .map(([section, sec]: any) => `
               <li style="margin-bottom: 6px; color: #3f3f46;">
                  <strong style="color: #18181b;">${section}</strong>: ${formatDuration(sec)}
               </li>
            `).join("")
         : `<li style="color: #71717a;">No active time recorded.</li>`;

      const content = `
         <p>Here is yesterday's anonymized telemetry findings report for <strong>${targetDate}</strong>:</p>

         <div style="margin: 20px 0; background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 18px;">
            <table style="width: 100%; border-collapse: collapse;">
               <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; font-size: 12px; text-transform: uppercase; font-weight: 700;">Active Devices</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; color: #18181b; font-weight: bold; font-size: 15px; text-align: right;">${activeDevices}</td>
               </tr>
               <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; font-size: 12px; text-transform: uppercase; font-weight: 700;">App Opens</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; color: #18181b; font-weight: bold; font-size: 15px; text-align: right;">${appOpens} (${avgOpens}/user)</td>
               </tr>
               <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; font-size: 12px; text-transform: uppercase; font-weight: 700;">Avg Time Spent</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e4e4e7; color: #18181b; font-weight: bold; font-size: 15px; text-align: right;">${formatDuration(Math.round(avgTimeSec))}</td>
               </tr>
               <tr>
                  <td style="padding: 8px 0; color: #71717a; font-size: 12px; text-transform: uppercase; font-weight: 700;">Bounce Rate</td>
                  <td style="padding: 8px 0; color: #dc2626; font-weight: bold; font-size: 15px; text-align: right;">${bounceRate}%</td>
               </tr>
            </table>
         </div>

         <div style="margin: 20px 0; background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 18px;">
            <h3 style="color: #18181b; font-size: 14px; font-weight: 800; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.04em;">Top Clicked Sections</h3>
            <ul style="padding-left: 20px; margin: 0; font-size: 14px; line-height: 1.6;">
               ${topClicksHtml}
            </ul>
         </div>

         <div style="margin: 20px 0; background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 18px;">
            <h3 style="color: #18181b; font-size: 14px; font-weight: 800; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.04em;">Time Spent per Section</h3>
            <ul style="padding-left: 20px; margin: 0; font-size: 14px; line-height: 1.6;">
               ${topTimeHtml}
            </ul>
         </div>

         <div style="margin: 28px 0 12px 0; text-align: center;">
            <a href="${APP_URL}/admin" class="btn-primary">Open Admin Dashboard</a>
         </div>
      `;

      const html = getEmailHtml("Admin", "admin", `Daily Telemetry Digest [${targetDate}]`, content);
      await sendEmailWithFallback("cemuchay@gmail.com", `Daily Telemetry Report (${targetDate})`, html);
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
        <p>Welcome to <strong>variant</strong>. We are thrilled to have you join our community of word puzzle solvers. Here is everything you need to know to get started.</p>
        
        <div class="section-box">
          <h3 style="color: #18181b; font-size: 15px; font-weight: 800; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.05em;">Daily Puzzles</h3>
          <p style="margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #52525b;">Each day brings a fresh puzzle. Choose your length (<strong>4, 5, 6, or 7 letters</strong>) and solve within 6 attempts. After each guess, tile colors guide your next step:</p>
          <ul style="color: #52525b; font-size: 14px; padding-left: 20px; line-height: 1.6; margin-bottom: 16px;">
            <li><strong style="color: #15803d;">Green:</strong> Correct letter in the exact position.</li>
            <li><strong style="color: #b45309;">Yellow:</strong> Letter is in the word but in a different spot.</li>
            <li><strong style="color: #71717a;">Gray:</strong> Letter is not in the word.</li>
          </ul>
          
          <!-- Native Clean Light Wordle Board -->
          <div style="margin: 16px auto; max-width: 240px; text-align: center;">
            <div style="display: flex; justify-content: center; gap: 6px; margin-bottom: 6px;">
              <div style="width: 38px; height: 38px; background-color: #e4e4e7; color: #18181b; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">W</div>
              <div style="width: 38px; height: 38px; background-color: #e4e4e7; color: #18181b; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">E</div>
              <div style="width: 38px; height: 38px; background-color: #e4e4e7; color: #18181b; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">A</div>
              <div style="width: 38px; height: 38px; background-color: #b59f3b; color: #ffffff; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">R</div>
              <div style="width: 38px; height: 38px; background-color: #e4e4e7; color: #18181b; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">Y</div>
            </div>
            <div style="display: flex; justify-content: center; gap: 6px; margin-bottom: 6px;">
              <div style="width: 38px; height: 38px; background-color: #538d4e; color: #ffffff; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">P</div>
              <div style="width: 38px; height: 38px; background-color: #e4e4e7; color: #18181b; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">I</div>
              <div style="width: 38px; height: 38px; background-color: #e4e4e7; color: #18181b; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">L</div>
              <div style="width: 38px; height: 38px; background-color: #b59f3b; color: #ffffff; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">O</div>
              <div style="width: 38px; height: 38px; background-color: #e4e4e7; color: #18181b; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">T</div>
            </div>
            <div style="display: flex; justify-content: center; gap: 6px;">
              <div style="width: 38px; height: 38px; background-color: #538d4e; color: #ffffff; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">P</div>
              <div style="width: 38px; height: 38px; background-color: #538d4e; color: #ffffff; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">R</div>
              <div style="width: 38px; height: 38px; background-color: #538d4e; color: #ffffff; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">O</div>
              <div style="width: 38px; height: 38px; background-color: #538d4e; color: #ffffff; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">S</div>
              <div style="width: 38px; height: 38px; background-color: #538d4e; color: #ffffff; line-height: 38px; font-size: 17px; font-weight: 800; border-radius: 4px; display: inline-block; font-family: sans-serif; text-align: center;">E</div>
            </div>
          </div>
        </div>

        <div class="section-box">
          <h3 style="color: #18181b; font-size: 15px; font-weight: 800; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.05em;">Challenges & Battles</h3>
          <p style="margin-bottom: 10px; font-size: 14px; line-height: 1.6; color: #52525b;">Challenge friends in real-time or async rounds. Enjoy <strong>Marathon Mode</strong>, custom words, and live <strong>WordUp Trivia Battles</strong> to earn rating points and trophies.</p>
        </div>

        <div style="margin: 32px 0 16px 0; text-align: center;">
          <a href="${APP_URL}" class="btn-primary">Start Playing Now</a>
        </div>
      `;

         const html = getEmailHtml(
            targetUsername,
            targetUserId,
            "Welcome to Variant",
            content,
         );

         const success = await sendEmailWithFallback(
            targetEmail,
            "Welcome to Variant",
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
            `[Fellow Copy] [To: ${targetEmail}] Welcome to Variant`,
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
         log(`Fetching skipped day recipients from DB...`);
         const { data: skippedRecipients, error: skippedErr } =
            await supabase.rpc("get_skipped_day_recipients");
         if (skippedErr) {
            log(`Error fetching skipped day recipients: ${skippedErr.message}`);
            throw skippedErr;
         }
         log(`Found ${skippedRecipients?.length || 0} skipped day recipients.`);

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
         }

         if (skippedRecipients && skippedRecipients.length > 0) {
            for (const recipient of skippedRecipients) {
               const content = `
            <div class="section-box" style="text-align: center;">
               <h3 style="margin: 0 0 8px 0; color: #18181b; font-size: 16px; font-weight: 800; text-transform: uppercase;">Your Daily Streak Needs You</h3>
               <p style="margin: 0; color: #52525b; font-size: 14px; line-height: 1.5;">You missed yesterday's puzzle, but today offers a fresh opportunity to stay sharp and defend your standing.</p>
            </div>
            <p style="color: #52525b; font-size: 14px; line-height: 1.6; text-align: center;">
               Today's word puzzle is live. It only takes a few minutes to test your vocabulary and climb the global leaderboard.
            </p>
            <div style="margin: 30px 0 16px 0; text-align: center;">
              <a href="${APP_URL}" class="btn-primary">Play Today's Word</a>
            </div>
          `;
               const html = getEmailHtml(
                  recipient.username,
                  recipient.user_id,
                  "Your Daily Puzzle Awaits",
                  content,
               );

               log(`Attempting to send morning email to ${recipient.email}...`);
               const success = await sendEmailWithFallback(
                  recipient.email,
                  "Your Daily Puzzle Awaits",
                  html,
               );
               if (success) {
                  sentCount++;
                  log(`Successfully sent email to ${recipient.email}`);
               }
            }
         }

         if (inactiveRecipients.length > 0) {
            for (const recipient of inactiveRecipients) {
               const content = `
            <div class="section-box" style="text-align: center;">
               <h3 style="margin: 0 0 8px 0; color: #18181b; font-size: 16px; font-weight: 800; text-transform: uppercase;">Reclaim Your Standing</h3>
               <p style="margin: 0; color: #52525b; font-size: 14px; line-height: 1.5;">It has been a few days since your last solve. The weekly leaderboard is heating up with fresh competition.</p>
            </div>
            <p style="color: #52525b; font-size: 14px; line-height: 1.6; text-align: center;">
               Jump back in this morning to test your skills, reclaim your rank, and qualify for weekly awards.
            </p>
            <div style="margin: 30px 0 16px 0; text-align: center;">
              <a href="${APP_URL}" class="btn-primary">Solve Today's Word</a>
            </div>
          `;
               const html = getEmailHtml(
                  recipient.username,
                  recipient.user_id,
                  "Reclaim Your Rank on the Leaderboard",
                  content,
               );

               log(`Attempting to send inactive reminder to ${recipient.email}...`);
               const success = await sendEmailWithFallback(
                  recipient.email,
                  "Reclaim Your Rank on the Leaderboard",
                  html,
               );
               if (success) {
                  sentCount++;
                  log(`Successfully sent inactive reminder to ${recipient.email}`);
               }
            }
         }

         if (sentCount === 0) {
            log(`No email reminders were sent to any users.`);
            const logsHtml = getLogsOnlyHtml("morning-reminders", logs);
            await sendEmailWithFallback(
               "cemuchay@gmail.com",
               `[Logs] morning-reminders - No recipients eligible`,
               logsHtml,
            );
         } else {
            log(`Finished morning-reminders. Total user emails sent: ${sentCount}`);
         }

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

      // ACTION: DAILY TELEMETRY DIGEST
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
         const { data: recipients, error: err } = await supabase.rpc(
            "get_streak_warning_recipients",
         );
         if (err) {
            log(`Error fetching streak warning recipients: ${err.message}`);
            throw err;
         }
         log(`Found ${recipients?.length || 0} streak warning recipients.`);
         if (recipients && recipients.length > 0) {
            for (const recipient of recipients) {
               const content = `
            <div class="section-box" style="border-left: 4px solid #f59e0b;">
               <p style="margin: 0; color: #18181b; font-size: 15px; font-weight: 700;">
                  You have an active ${recipient.current_streak}-day winning streak at risk.
               </p>
               <p style="margin: 8px 0 0 0; color: #52525b; font-size: 14px;">
                  You haven't played today yet. Solve today's Word before midnight to keep your streak alive.
               </p>
            </div>
            <div style="margin: 30px 0 16px 0; text-align: center;">
              <a href="${APP_URL}" class="btn-primary">Save My Streak</a>
            </div>
          `;
               const html = getEmailHtml(
                  recipient.username,
                  recipient.user_id,
                  "Streak Warning: Save Your Streak",
                  content,
               );
               const subject = `Streak Warning: Save your ${recipient.current_streak}-day streak`;

               log(`Attempting to send streak warning to ${recipient.email}...`);
               const success = await sendEmailWithFallback(
                  recipient.email,
                  subject,
                  html,
               );
               if (success) {
                  sentCount++;
                  log(`Successfully sent email to ${recipient.email}`);
               }
            }
         }

         if (sentCount === 0) {
            log(`No streak warning emails were sent.`);
            const logsHtml = getLogsOnlyHtml("evening-reminders", logs);
            await sendEmailWithFallback(
               "cemuchay@gmail.com",
               `[Logs] evening-reminders - No recipients eligible`,
               logsHtml,
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

         // Compute previous week's Monday (start) to Sunday (end)
         const prevMonday = new Date();
         const dayOfWeek = (prevMonday.getDay() + 6) % 7;
         prevMonday.setDate(prevMonday.getDate() - dayOfWeek - 7);
         const prevSunday = new Date(prevMonday);
         prevSunday.setDate(prevSunday.getDate() + 6);

         const prevMondayStr = prevMonday.toISOString().split("T")[0];
         const prevSundayStr = prevSunday.toISOString().split("T")[0];

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

         // TASK 4: Fetch all winning words of the week from scores table (cached once for all emails)
         log(`Fetching words of the week for range ${prevMondayStr} to ${prevSundayStr}...`);
         const { data: weekScores, error: weekScoresErr } = await supabase
            .from("scores")
            .select("game_date, guesses")
            .gte("game_date", prevMondayStr)
            .lte("game_date", prevSundayStr)
            .eq("status", "won");

         if (weekScoresErr) {
            log(`Warning: Error fetching week scores: ${weekScoresErr.message}`);
         }

         const weeklyWordsMap: Record<string, string> = {};
         if (weekScores && Array.isArray(weekScores)) {
            for (const score of weekScores) {
               if (!weeklyWordsMap[score.game_date] && Array.isArray(score.guesses) && score.guesses.length > 0) {
                  const lastGuess = score.guesses[score.guesses.length - 1];
                  if (Array.isArray(lastGuess)) {
                     const word = lastGuess.map((g: any) => g.letter).join("");
                     if (word) {
                        weeklyWordsMap[score.game_date] = word.toUpperCase();
                     }
                  }
               }
            }
         }

         // Generate 7-day breakdown (Monday through Sunday)
         const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
         let wordsOfTheWeekHtml = "";
         const wordsRowsHtml: string[] = [];

         for (let i = 0; i < 7; i++) {
            const d = new Date(prevMonday);
            d.setDate(d.getDate() + i);
            const dStr = d.toISOString().split("T")[0];
            const word = weeklyWordsMap[dStr];
            const dateFormatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

            if (word) {
               const tiles = word
                  .split("")
                  .map(
                     (char) =>
                        `<span style="display: inline-block; width: 22px; height: 22px; line-height: 22px; text-align: center; font-size: 11px; font-weight: 800; background-color: #18181b; color: #ffffff; border-radius: 3px; margin: 0 1px;">${char}</span>`,
                  )
                  .join("");

               wordsRowsHtml.push(`
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                     <td style="padding: 8px 10px; font-size: 13px; color: #52525b; font-weight: 600; white-space: nowrap;">
                        <strong>${dayNames[i]}</strong>, ${dateFormatted}
                     </td>
                     <td style="padding: 8px 10px; text-align: right; white-space: nowrap;">
                        ${tiles}
                        <span style="font-size: 11px; color: #71717a; margin-left: 6px; font-weight: 600;">(${word.length} letters)</span>
                     </td>
                  </tr>
               `);
            } else {
               wordsRowsHtml.push(`
                  <tr style="border-bottom: 1px solid #e4e4e7;">
                     <td style="padding: 8px 10px; font-size: 13px; color: #52525b; font-weight: 600; white-space: nowrap;">
                        <strong>${dayNames[i]}</strong>, ${dateFormatted}
                     </td>
                     <td style="padding: 8px 10px; text-align: right; font-size: 12px; color: #a1a1aa; font-style: italic;">
                        —
                     </td>
                  </tr>
               `);
            }
         }

         if (wordsRowsHtml.length > 0) {
            wordsOfTheWeekHtml = `
               <div class="section-box" style="margin: 24px 0; padding: 18px 20px;">
                  <div style="border-bottom: 1px solid #e4e4e7; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: baseline;">
                     <h3 style="font-family: 'Newsreader', Georgia, serif; color: #18181b; font-size: 16px; font-weight: 800; margin: 0;">
                        Words of the Week
                     </h3>
                     <span style="font-size: 11px; color: #71717a; font-weight: 600;">
                        ${prevMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${prevSunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                     </span>
                  </div>
                  <table style="width: 100%; border-collapse: collapse;">
                     <tbody>
                        ${wordsRowsHtml.join("")}
                     </tbody>
                  </table>
               </div>
            `;
         }

         // 2. Fetch Weekly Report recipients
         log(`Fetching weekly report recipients from DB...`);
         const { data: recipients, error: recErr } = await supabase.rpc(
            "get_weekly_report_recipients",
         );
         if (recErr) {
            log(`Error fetching weekly report recipients: ${recErr.message}`);
            throw recErr;
         }
         log(`Found ${recipients?.length || 0} weekly report recipients.`);

         if (
            recipients &&
            recipients.length > 0 &&
            leaderboard &&
            leaderboard.length > 0
         ) {
            for (const recipient of recipients) {
               const myIndex = leaderboard.findIndex(
                  (entry: any) => entry.username === recipient.username,
               );
               const myRank = myIndex !== -1 ? myIndex + 1 : null;
               const myPoints =
                  myIndex !== -1 ? leaderboard[myIndex].total_points : 0;
               const myDaysActive =
                  myIndex !== -1 ? leaderboard[myIndex].days_active : 0;

               // Determine relative leaderboard window (11 players)
               let start = 0;
               let end = 10;
               if (myIndex !== -1) {
                  start = Math.max(0, myIndex - 5);
                  end = Math.min(leaderboard.length, myIndex + 6);
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

                  const rowBg = isMe ? "background-color: #f4f4f5; border-left: 3px solid #18181b;" : "border-bottom: 1px solid #e4e4e7;";
                  const textStyle = isMe ? "font-weight: 800; color: #18181b;" : "color: #3f3f46;";
                  const avatarSrc = getAvatarUrl(entry.avatar_url, entry.username);

                  tableRowsHtml += `
                     <tr style="${rowBg}">
                        <td style="padding: 10px 8px; font-weight: 800; font-size: 12px; color: #71717a; white-space: nowrap;">
                           #${rank}
                        </td>
                        <td style="padding: 10px 8px; font-size: 13px; white-space: nowrap; ${textStyle}">
                           <img src="${avatarSrc}" alt="" style="width: 24px; height: 24px; border-radius: 50%; vertical-align: middle; margin-right: 6px; border: 1px solid #d4d4d8;" />
                           <span style="vertical-align: middle;">${formatUsername(entry.username)}${isMe ? ' <span style="background: #18181b; color: #ffffff; font-size: 9px; padding: 1px 5px; border-radius: 3px; font-weight: 800; text-transform: uppercase;">YOU</span>' : ""}</span>
                           ${awardIcons ? `<span style="margin-left: 4px; font-size: 12px; vertical-align: middle;">${awardIcons}</span>` : ''}
                        </td>
                        <td style="padding: 10px 8px; text-align: right; font-weight: 800; font-size: 13px; color: #18181b; white-space: nowrap;">
                           ${entry.total_points.toLocaleString()}
                        </td>
                        <td style="padding: 10px 8px; text-align: right; color: #71717a; font-size: 12px; font-weight: 600; white-space: nowrap;">
                           ${entry.days_active}/7d
                        </td>
                     </tr>
                  `;
               });

               const leaderboardTableHtml = `
                  <div style="width: 100%; overflow-x: auto; margin: 16px 0; border: 1px solid #e4e4e7; border-radius: 6px; background-color: #ffffff;">
                     <table style="width: 100%; min-width: 440px; border-collapse: collapse;">
                        <thead>
                           <tr style="background-color: #fafafa; border-bottom: 1px solid #e4e4e7;">
                              <th style="padding: 10px 8px; text-align: left; font-size: 10px; font-weight: 800; color: #71717a; text-transform: uppercase; letter-spacing: 0.06em;">Rank</th>
                              <th style="padding: 10px 8px; text-align: left; font-size: 10px; font-weight: 800; color: #71717a; text-transform: uppercase; letter-spacing: 0.06em;">Player</th>
                              <th style="padding: 10px 8px; text-align: right; font-size: 10px; font-weight: 800; color: #71717a; text-transform: uppercase; letter-spacing: 0.06em;">Points</th>
                              <th style="padding: 10px 8px; text-align: right; font-size: 10px; font-weight: 800; color: #71717a; text-transform: uppercase; letter-spacing: 0.06em;">Puzzles</th>
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
                  statsSummaryHtml = `
                     <div class="section-box" style="margin: 20px 0; text-align: center;">
                        <div style="font-size: 10px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.12em; color: #71717a; margin-bottom: 8px;">Your Weekly Performance</div>
                        <table style="width: 100%; border-collapse: collapse;">
                           <tr>
                              <td style="text-align: center; padding: 6px; width: 33%;">
                                 <span style="display: block; font-size: 24px; font-weight: 900; color: #18181b;">#${myRank}</span>
                                 <span style="font-size: 10px; color: #71717a; text-transform: uppercase; font-weight: 700;">Global Rank</span>
                              </td>
                              <td style="text-align: center; padding: 6px; width: 33%; border-left: 1px solid #e4e4e7; border-right: 1px solid #e4e4e7;">
                                 <span style="display: block; font-size: 24px; font-weight: 900; color: #18181b;">${myPoints.toLocaleString()}</span>
                                 <span style="font-size: 10px; color: #71717a; text-transform: uppercase; font-weight: 700;">Points</span>
                              </td>
                              <td style="text-align: center; padding: 6px; width: 33%;">
                                 <span style="display: block; font-size: 24px; font-weight: 900; color: #18181b;">${myDaysActive}/7</span>
                                 <span style="font-size: 10px; color: #71717a; text-transform: uppercase; font-weight: 700;">Days Active</span>
                              </td>
                           </tr>
                        </table>
                     </div>
                  `;
               }

               const content = `
                  <p style="font-size: 15px; color: #3f3f46; line-height: 1.6;">
                     Another week of puzzles has concluded. Here is your weekly summary and standings:
                  </p>
                  ${statsSummaryHtml}
                  ${wordsOfTheWeekHtml}
                  <div style="margin: 24px 0 10px 0;">
                     <h3 style="color: #18181b; font-size: 15px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.04em;">Leaderboard Standing</h3>
                  </div>
                  ${leaderboardTableHtml}
                  <div style="margin: 32px 0 16px 0; text-align: center;">
                     <a href="${APP_URL}" class="btn-primary">View Full Leaderboard</a>
                  </div>
               `;

               const html = getEmailHtml(
                  recipient.username,
                  recipient.user_id,
                  "Your Weekly Wordle Recap",
                  content,
               );
               const subject = "Your Weekly Wordle Recap & Standings";

               log(`Attempting to send weekly report to ${recipient.email}...`);
               const success = await sendEmailWithFallback(
                  recipient.email,
                  subject,
                  html,
               );
               if (success) {
                  sentCount++;
                  log(`Successfully sent email to ${recipient.email}`);
               }
            }
         }

         if (sentCount === 0) {
            log(`No weekly report emails were sent.`);
            const logsHtml = getLogsOnlyHtml("weekly-report", logs);
            await sendEmailWithFallback(
               "cemuchay@gmail.com",
               `[Logs] weekly-report - No recipients eligible`,
               logsHtml,
            );
         } else {
            log(`Finished weekly-report processing. Total user emails sent: ${sentCount}`);
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

         const { data: recipients, error } = await supabase.rpc("get_active_users_for_bot_marathon");
         if (error) throw error;

         const emailEligible = (recipients || []).filter((r: any) => !r.has_push_sub && r.receive_emails);
         log(`Found ${emailEligible.length} active users eligible for bot marathon email notification.`);

         for (const r of emailEligible) {
            const content = `
               <p>A new <strong>Daily Bot Marathon Event</strong> is now live.</p>
               <p>Compete against <strong>Variant Bot</strong> and players worldwide across sequential 3 to 7-letter word puzzles to claim top standing on the leaderboard.</p>
               <div style="margin: 28px 0 16px 0; text-align: center;">
                 <a href="${targetUrl}" class="btn-primary">Join Bot Marathon</a>
               </div>
            `;
            const html = getEmailHtml(r.username, r.user_id, "New Bot Marathon Event", content);
            const success = await sendEmailWithFallback(r.email, "New Bot Marathon Event - Compete Now", html);
            if (success) sentCount++;
         }

         return new Response(
            JSON.stringify({ success: true, action, emails_sent: sentCount }),
            {
               headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
         );
      }

      return new Response(
         JSON.stringify({ error: `Unhandled action: ${action}` }),
         {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
         },
      );
   } catch (err: any) {
      log(`Top-level error: ${err.message || err}`);
      return new Response(
         JSON.stringify({ error: err.message || "Internal server error" }),
         {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
         },
      );
   }
});
