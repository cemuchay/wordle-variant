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

// Helper to produce an accurate, pleasant time-based greeting or fallback
const getTimeBasedGreeting = (customGreeting?: string): string => {
   if (customGreeting && customGreeting.trim()) {
      return customGreeting.trim();
   }
   // Use UTC hour offset check (or standard universal greeting)
   const currentHour = new Date().getUTCHours();
   // Roughly accounts for morning / afternoon / evening across UTC to UTC+3/WAT
   if (currentHour >= 4 && currentHour < 12) {
      return "Good morning";
   } else if (currentHour >= 12 && currentHour < 17) {
      return "Good afternoon";
   } else if (currentHour >= 17 && currentHour < 22) {
      return "Good evening";
   }
   return "Hello";
};

// Clean, professional editorial light mode HTML email template wrapper (WSJ / NYT style)
const getEmailHtml = (
   username: string,
   userId: string,
   title: string,
   contentHtml: string,
   customGreeting?: string,
) => {
   const greetingWord = getTimeBasedGreeting(customGreeting);
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
            <p class="greeting">${greetingWord}, <strong>${formatUsername(username)}</strong> —</p>
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

// ============================================================================
// DYNAMIC DUOLINGO-STYLE REMINDER TEMPLATES
// ============================================================================

interface DynamicEmailTemplate {
   subject: string;
   html: string;
}

const getRandomItem = <T>(items: T[]): T => {
   return items[Math.floor(Math.random() * items.length)];
};

// --- Helper: Dynamic Tile Grid Previews ---
const renderMiniTile = (letter: string, bg: string, color = "#ffffff") => `
   <div style="display: inline-block; width: 34px; height: 34px; line-height: 34px; background-color: ${bg}; color: ${color}; font-weight: 800; font-size: 16px; border-radius: 6px; margin: 0 2px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-shadow: 0 2px 0 rgba(0,0,0,0.1);">${letter}</div>
`;

const renderTileRow = (letters: string[], bgs: string[]) => `
   <div style="margin: 4px 0; text-align: center;">
      ${letters.map((l, i) => renderMiniTile(l, bgs[i] || "#e4e4e7", bgs[i] === "#e4e4e7" ? "#18181b" : "#ffffff")).join("")}
   </div>
`;

// Clean Duolingo-style action card wrapper supporting playful color themes
const getDuolingoCardHtml = (
   username: string,
   userId: string,
   opts: {
      accentColor: string;
      accentBg: string;
      accentBorder: string;
      btnBg: string;
      btnColor?: string;
      badge: string;
      badgeEmoji: string;
      title: string;
      punchline: string;
      innerCardHtml: string;
      ctaText: string;
      footerNote?: string;
   },
) => {
   const formattedName = formatUsername(username);
   const unsubscribeUrl = `${APP_URL}/unsubscribe?user_id=${userId}`;

   return `
   <!DOCTYPE html>
   <html lang="en">
     <head>
       <meta charset="utf-8">
       <meta name="viewport" content="width=device-width, initial-scale=1.0">
       <title>${opts.title}</title>
       <style>
         body {
           background-color: #f4f4f5;
           color: #18181b;
           font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
           margin: 0;
           padding: 0;
           -webkit-font-smoothing: antialiased;
         }
         .container {
           max-width: 540px;
           margin: 0 auto;
           padding: 28px 14px;
         }
         .card {
           background-color: #ffffff;
           border: 2px solid ${opts.accentBorder};
           border-radius: 20px;
           padding: 32px 24px;
           box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.08);
           text-align: center;
         }
         .brand-header {
           display: inline-block;
           font-size: 11px;
           font-weight: 900;
           letter-spacing: 0.16em;
           color: #71717a;
           text-transform: uppercase;
           margin-bottom: 20px;
         }
         .badge-pill {
           display: inline-block;
           background-color: ${opts.accentBg};
           color: ${opts.accentColor};
           border: 1.5px solid ${opts.accentBorder};
           font-size: 12px;
           font-weight: 800;
           padding: 6px 14px;
           border-radius: 999px;
           text-transform: uppercase;
           letter-spacing: 0.05em;
           margin-bottom: 14px;
         }
         h1 {
           font-size: 26px;
           font-weight: 900;
           line-height: 1.2;
           letter-spacing: -0.02em;
           color: #18181b;
           margin: 0 0 10px 0;
         }
         .punchline {
           font-size: 16px;
           font-weight: 500;
           line-height: 1.5;
           color: #52525b;
           margin: 0 auto 20px auto;
           max-width: 440px;
         }
         .inner-card {
           background-color: ${opts.accentBg};
           border: 1.5px solid ${opts.accentBorder};
           border-radius: 14px;
           padding: 20px 18px;
           margin: 20px 0 24px 0;
           text-align: center;
         }
         .btn-cta {
           display: inline-block;
           background-color: ${opts.btnBg};
           color: ${opts.btnColor || "#ffffff"} !important;
           font-size: 15px;
           font-weight: 800;
           text-decoration: none;
           padding: 14px 34px;
           border-radius: 12px;
           box-shadow: 0 4px 14px 0 rgba(0, 0, 0, 0.12);
           text-transform: uppercase;
           letter-spacing: 0.04em;
         }
         .footer {
           margin-top: 28px;
           text-align: center;
           border-top: 1px solid #e4e4e7;
           padding-top: 18px;
         }
         .footer-text {
           color: #a1a1aa;
           font-size: 11px;
           line-height: 1.5;
           margin: 0;
         }
         .footer-link {
           color: #71717a;
           text-decoration: underline;
           font-weight: 600;
         }
       </style>
     </head>
     <body>
       <div class="container">
         <div class="card">
           <div class="brand-header">⚡ VARIANT DAILY WORDS ⚡</div>
           <div>
             <span class="badge-pill">${opts.badgeEmoji} ${opts.badge}</span>
           </div>
           <h1>${opts.title}</h1>
           <p class="punchline">Hey <strong>${formattedName}</strong>, ${opts.punchline}</p>
           
           <div class="inner-card">
             ${opts.innerCardHtml}
           </div>

           <div style="margin: 26px 0 8px 0;">
             <a href="${APP_URL}" class="btn-cta">${opts.ctaText} →</a>
           </div>

           ${opts.footerNote ? `<div style="font-size: 12px; font-weight: 600; color: #71717a; margin-top: 12px;">${opts.footerNote}</div>` : ""}

           <div class="footer">
             <p class="footer-text">
               Sent with 💚 from <strong>wordle-variant.xyz</strong>.<br/>
               Take 3 minutes to keep your mind sharp.<br/>
               <a href="${unsubscribeUrl}" class="footer-link">Unsubscribe or manage notification settings</a>
             </p>
           </div>
         </div>
       </div>
     </body>
   </html>
   `;
};

// 1. Morning Skipped Day Reminder - 4 Random Duolingo-style variants
const getMorningSkippedReminderTemplate = (
   username: string,
   userId: string,
): DynamicEmailTemplate => {
   const formattedName = formatUsername(username);

   const templates: DynamicEmailTemplate[] = [
      // Style 1: Playful Guilt / Duolingo Owl Sassy Tone
      {
         subject: `👀 ${formattedName}, these words aren't going to guess themselves...`,
         html: getDuolingoCardHtml(username, userId, {
            accentColor: "#ea580c",
            accentBg: "#fff7ed",
            accentBorder: "#fed7aa",
            btnBg: "#ea580c",
            badge: "DAILY HABIT CHECK",
            badgeEmoji: "🦉",
            title: "Did you forget about us yesterday?",
            punchline: "Your brain cells called. They miss the green tiles.",
            innerCardHtml: `
               <p style="margin: 0 0 12px 0; font-size: 14px; color: #7c2d12; font-weight: 700;">
                  Yesterday's puzzle slipped past, but today is wide open!
               </p>
               <div style="margin: 10px 0;">
                  ${renderTileRow(["R", "E", "A", "D", "Y"], ["#538d4e", "#b59f3b", "#e4e4e7", "#538d4e", "#e4e4e7"])}
                  ${renderTileRow(["S", "H", "A", "R", "P"], ["#538d4e", "#538d4e", "#538d4e", "#538d4e", "#538d4e"])}
               </div>
               <p style="margin: 12px 0 0 0; font-size: 13px; color: #9a3412;">
                  Takes under 3 minutes. Shake off the cobwebs before lunch!
               </p>
            `,
            ctaText: "Play Today's Puzzle",
            footerNote: "☕ Pairs great with your morning coffee",
         }),
      },

      // Style 2: High Energy / Comeback Hype
      {
         subject: `🔥 Ready for a comeback, ${formattedName}? Today's puzzle is live!`,
         html: getDuolingoCardHtml(username, userId, {
            accentColor: "#16a34a",
            accentBg: "#f0fdf4",
            accentBorder: "#bbf7d0",
            btnBg: "#16a34a",
            badge: "COMEBACK MISSION",
            badgeEmoji: "⚡",
            title: "Bounce Back Like a Champion!",
            punchline: "You took a day off yesterday, but true word masters always return stronger.",
            innerCardHtml: `
               <div style="font-size: 32px; margin-bottom: 8px;">🎯</div>
               <p style="margin: 0 0 8px 0; font-size: 15px; color: #166534; font-weight: 800;">
                  Fresh daily secret word waiting for you right now.
               </p>
               <p style="margin: 0; font-size: 13px; color: #15803d; line-height: 1.5;">
                  Choose 4, 5, 6, or 7 letters and crack it in 6 tries. The leaderboard is moving fast!
               </p>
            `,
            ctaText: "Start My Comeback",
            footerNote: "⚡ 6 guesses • Infinite satisfaction",
         }),
      },

      // Style 3: Brain Gym / Mental Fitness Push
      {
         subject: `🧠 3-minute morning brain workout for ${formattedName}`,
         html: getDuolingoCardHtml(username, userId, {
            accentColor: "#4f46e5",
            accentBg: "#eef2ff",
            accentBorder: "#c7d2fe",
            btnBg: "#4f46e5",
            badge: "DAILY MENTAL GYM",
            badgeEmoji: "🧠",
            title: "Warm Up Your Brain Today",
            punchline: "Crosswords are too long. Variant takes 3 minutes and wakes up your linguistic cortex.",
            innerCardHtml: `
               <p style="margin: 0 0 10px 0; font-size: 14px; color: #3730a3; font-weight: 700;">
                  TODAY'S WORKOUT TARGET:
               </p>
               <div style="margin: 8px 0;">
                  ${renderTileRow(["S", "O", "L", "V", "E"], ["#538d4e", "#538d4e", "#538d4e", "#538d4e", "#538d4e"])}
               </div>
               <p style="margin: 10px 0 0 0; font-size: 13px; color: #4338ca;">
                  Solve today's puzzle to restart your momentum and stay ahead of the pack.
               </p>
            `,
            ctaText: "Claim My 3-Min Workout",
            footerNote: "✨ Better than scrolling social media",
         }),
      },

      // Style 4: Classic Clean Editorial with a Playful Punch
      {
         subject: `📰 Today's secret word is waiting for you, ${formattedName}`,
         html: getDuolingoCardHtml(username, userId, {
            accentColor: "#0891b2",
            accentBg: "#ecfeff",
            accentBorder: "#a5f3fc",
            btnBg: "#0891b2",
            badge: "TODAY'S EDITION",
            badgeEmoji: "🗞️",
            title: "A Brand New Puzzle is In Print",
            punchline: "Yesterday is in the past. Today's word has stumped quite a few players already.",
            innerCardHtml: `
               <p style="margin: 0 0 8px 0; font-size: 14px; color: #155e75; font-weight: 700;">
                  Can you guess it in fewer than 4 attempts?
               </p>
               <p style="margin: 0; font-size: 13px; color: #0e7490; line-height: 1.5;">
                  Log your score, earn points for the weekly trophy, and prove your vocabulary reigns supreme.
               </p>
            `,
            ctaText: "Solve Today's Edition",
            footerNote: "🏆 Weekly awards are distributed every Monday",
         }),
      },
   ];

   return getRandomItem(templates);
};

// 2. 3-Day Inactive Reminder - 3 Playful Duolingo-style variants
const getInactiveReminderTemplate = (
   username: string,
   userId: string,
): DynamicEmailTemplate => {
   const formattedName = formatUsername(username);

   const templates: DynamicEmailTemplate[] = [
      // Style 1: Playful Guilt / Missing You
      {
         subject: `🥺 We miss you, ${formattedName}! It's been 3 days...`,
         html: getDuolingoCardHtml(username, userId, {
            accentColor: "#db2777",
            accentBg: "#fdf2f8",
            accentBorder: "#fbcfe8",
            btnBg: "#db2777",
            badge: "WE MISS YOU",
            badgeEmoji: "💔",
            title: "Don't Leave Us on Read!",
            punchline: "It's been 3 days since your last solve. The word tiles are getting lonely.",
            innerCardHtml: `
               <div style="font-size: 32px; margin-bottom: 6px;">🥺</div>
               <p style="margin: 0 0 8px 0; font-size: 15px; color: #9d174d; font-weight: 800;">
                  Just one game to get back in the groove!
               </p>
               <p style="margin: 0; font-size: 13px; color: #be185d; line-height: 1.5;">
                  Your weekly leaderboard position is slipping, but one quick win puts you right back in contention.
               </p>
            `,
            ctaText: "Reclaim My Spot",
            footerNote: "⏱️ Only 3 minutes to play",
         }),
      },

      // Style 2: Challenge & Rivalry
      {
         subject: `🏆 Players are passing you on the leaderboard, ${formattedName}!`,
         html: getDuolingoCardHtml(username, userId, {
            accentColor: "#9333ea",
            accentBg: "#faf5ff",
            accentBorder: "#e9d5ff",
            btnBg: "#9333ea",
            badge: "LEADERBOARD ALERT",
            badgeEmoji: "⚔️",
            title: "Your Standing is Under Attack!",
            punchline: "A few days of rest and suddenly your rivals are climbing the ranks.",
            innerCardHtml: `
               <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b21a8; font-weight: 700;">
                  Today is Monday — the new weekly tournament just kicked off!
               </p>
               <div style="margin: 8px 0;">
                  ${renderTileRow(["F", "I", "G", "H", "T"], ["#b59f3b", "#538d4e", "#e4e4e7", "#538d4e", "#538d4e"])}
               </div>
               <p style="margin: 10px 0 0 0; font-size: 13px; color: #7e22ce;">
                  Score high today to get on the podium before the week gets crowded.
               </p>
            `,
            ctaText: "Defend My Rank",
            footerNote: "🥇 Weekly champions receive profile badges",
         }),
      },

      // Style 3: Clean Duolingo Encouragement
      {
         subject: `✨ Ready for a fresh start, ${formattedName}? Today's puzzle is waiting`,
         html: getDuolingoCardHtml(username, userId, {
            accentColor: "#059669",
            accentBg: "#ecfdf5",
            accentBorder: "#a7f3d0",
            btnBg: "#059669",
            badge: "FRESH START",
            badgeEmoji: "🌱",
            title: "Small Habits Build Big Brains",
            punchline: "Life gets busy, we get it! But keeping your mind sharp only takes 180 seconds.",
            innerCardHtml: `
               <p style="margin: 0 0 8px 0; font-size: 15px; color: #065f46; font-weight: 800;">
                  Zero stress. Just you and a 5-letter puzzle.
               </p>
               <p style="margin: 0; font-size: 13px; color: #047857; line-height: 1.5;">
                  Grab a cup of something hot, sit back, and enjoy today's challenge.
               </p>
            `,
            ctaText: "Jump Back In",
            footerNote: "🎮 Free to play • No downloads needed",
         }),
      },
   ];

   return getRandomItem(templates);
};

// 3. Evening Streak Warning - 4 Dramatic Duolingo-style variants
const getEveningStreakWarningTemplate = (
   username: string,
   userId: string,
   currentStreak: number,
): DynamicEmailTemplate => {
   const formattedName = formatUsername(username);

   const templates: DynamicEmailTemplate[] = [
      // Style 1: Urgent Duolingo Owl Sassy Alarm
      {
         subject: `🚨 ${formattedName}! Don't let your ${currentStreak}-day streak die tonight!`,
         html: getDuolingoCardHtml(username, userId, {
            accentColor: "#dc2626",
            accentBg: "#fef2f2",
            accentBorder: "#fecaca",
            btnBg: "#dc2626",
            badge: "CRITICAL STREAK ALERT",
            badgeEmoji: "🚨",
            title: "DON'T LET IT RESET TO ZERO!",
            punchline: `You worked hard for that <strong>${currentStreak}-day winning streak</strong>. If you don't play before midnight, it's gone forever.`,
            innerCardHtml: `
               <div style="font-size: 42px; font-weight: 900; color: #dc2626; margin: 4px 0;">
                  🔥 ${currentStreak} DAYS 🔥
               </div>
               <div style="font-size: 13px; font-weight: 800; color: #991b1b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px;">
                  AT RISK RIGHT NOW
               </div>
               <p style="margin: 0; font-size: 14px; color: #7f1d1d; line-height: 1.5;">
                  It takes <strong>less than 3 minutes</strong>. Solve today's word before the clock strikes 12 and keep your crown!
               </p>
            `,
            ctaText: "Save My Streak",
            footerNote: "⏰ Resets at midnight Africa/Lagos time",
         }),
      },

      // Style 2: Dramatic Heartbreak / Personified Streak
      {
         subject: `💔 Your ${currentStreak}-day streak is about to vanish, ${formattedName}`,
         html: getDuolingoCardHtml(username, userId, {
            accentColor: "#d97706",
            accentBg: "#fffbeb",
            accentBorder: "#fde68a",
            btnBg: "#d97706",
            badge: "STREAK COUNTDOWN",
            badgeEmoji: "⏳",
            title: "Your Streak Needs You!",
            punchline: `A ${currentStreak}-day streak is rare — fewer than 5% of players ever reach it.`,
            innerCardHtml: `
               <p style="margin: 0 0 10px 0; font-size: 15px; color: #92400e; font-weight: 800;">
                  Don't throw away ${currentStreak} days of perfection!
               </p>
               <div style="margin: 10px 0;">
                  ${renderTileRow(["S", "A", "V", "E", "D"], ["#538d4e", "#538d4e", "#538d4e", "#538d4e", "#538d4e"])}
               </div>
               <p style="margin: 10px 0 0 0; font-size: 13px; color: #b45309;">
                  One quick solve right now preserves your streak history and profile brag rights.
               </p>
            `,
            ctaText: "Keep Streak Alive",
            footerNote: "🔥 It's waiting for you right now",
         }),
      },

      // Style 3: Midnight Countdown Clock
      {
         subject: `⏰ Clock is ticking, ${formattedName}! Save your ${currentStreak}-day streak`,
         html: getDuolingoCardHtml(username, userId, {
            accentColor: "#b91c1c",
            accentBg: "#fef2f2",
            accentBorder: "#fca5a5",
            btnBg: "#b91c1c",
            badge: "NIGHT CALL",
            badgeEmoji: "🌙",
            title: "A Quick Solve Before Bed?",
            punchline: `Only a few hours remain before today's puzzle locks and your <strong>${currentStreak}-day streak</strong> expires.`,
            innerCardHtml: `
               <div style="font-size: 34px; margin-bottom: 6px;">🛌 ➡️ 🏆</div>
               <p style="margin: 0 0 8px 0; font-size: 15px; color: #991b1b; font-weight: 800;">
                  Solve it before you sleep.
               </p>
               <p style="margin: 0; font-size: 13px; color: #7f1d1d; line-height: 1.5;">
                  Nothing sleeps better than the peaceful satisfaction of an all-green word row.
               </p>
            `,
            ctaText: "Play Before Midnight",
            footerNote: "🌙 Sweet dreams guaranteed with a win",
         }),
      },

      // Style 4: Hyped Gamer Focus
      {
         subject: `🔥 Defend your honor: ${currentStreak}-day streak on the line, ${formattedName}!`,
         html: getDuolingoCardHtml(username, userId, {
            accentColor: "#ea580c",
            accentBg: "#fff7ed",
            accentBorder: "#fed7aa",
            btnBg: "#ea580c",
            badge: "STREAK DEFENSE",
            badgeEmoji: "🛡️",
            title: "Your Streak is on the Line!",
            punchline: `Day ${currentStreak} was won. Day ${currentStreak + 1} is waiting. Will you answer the call?`,
            innerCardHtml: `
               <div style="background: #18181b; border-radius: 10px; padding: 14px; margin: 8px 0; color: #ffffff;">
                  <span style="font-size: 11px; text-transform: uppercase; color: #a1a1aa; font-weight: 800; letter-spacing: 0.1em; display: block; margin-bottom: 4px;">Streak Multiplier</span>
                  <span style="font-size: 28px; font-weight: 900; color: #fbbf24;">${currentStreak} ➡️ ${currentStreak + 1}</span>
               </div>
               <p style="margin: 10px 0 0 0; font-size: 13px; color: #9a3412; font-weight: 600;">
                  Lock in today's victory before the midnight refresh.
               </p>
            `,
            ctaText: "Lock in Day " + (currentStreak + 1),
            footerNote: "⚡ Your streak is your legend",
         }),
      },
   ];

   return getRandomItem(templates);
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
               // Select a random catchy Duolingo-style morning reminder
               const dynamicEmail = getMorningSkippedReminderTemplate(
                  recipient.username,
                  recipient.user_id,
               );

               log(`Attempting to send morning email to ${recipient.email} (Subject: ${dynamicEmail.subject})...`);
               const success = await sendEmailWithFallback(
                  recipient.email,
                  dynamicEmail.subject,
                  dynamicEmail.html,
               );
               if (success) {
                  sentCount++;
                  log(`Successfully sent email to ${recipient.email}`);
               }
            }
         }

         if (inactiveRecipients.length > 0) {
            for (const recipient of inactiveRecipients) {
               // Select a random catchy Duolingo-style inactive reminder
               const dynamicEmail = getInactiveReminderTemplate(
                  recipient.username,
                  recipient.user_id,
               );

               log(`Attempting to send inactive reminder to ${recipient.email} (Subject: ${dynamicEmail.subject})...`);
               const success = await sendEmailWithFallback(
                  recipient.email,
                  dynamicEmail.subject,
                  dynamicEmail.html,
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
               // Select a random catchy Duolingo-style evening streak warning
               const dynamicEmail = getEveningStreakWarningTemplate(
                  recipient.username,
                  recipient.user_id,
                  recipient.current_streak || 1,
               );

               log(`Attempting to send streak warning to ${recipient.email} (Subject: ${dynamicEmail.subject})...`);
               const success = await sendEmailWithFallback(
                  recipient.email,
                  dynamicEmail.subject,
                  dynamicEmail.html,
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

      // ACTION: ADMIN CUSTOM BROADCAST
      if (action === "admin-custom-broadcast") {
         log(`Starting action admin-custom-broadcast for user ${body.username || "Player"} (${body.email})`);
         const recipientEmail = body.email;
         const username = body.username || "Player";
         const userId = body.user_id || "admin-broadcast";
         const title = body.title || "Announcement from Variant";
         const messageText = body.message || "";
         const targetUrl = body.url ? (body.url.startsWith("http") ? body.url : `${APP_URL}${body.url.startsWith("/") ? "" : "/"}${body.url}`) : APP_URL;

         if (!recipientEmail) {
            log(`Error: Missing email address for admin-custom-broadcast`);
            return new Response(
               JSON.stringify({ error: "Missing email address in payload" }),
               {
                  status: 400,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
               },
            );
         }

         // Format markdown & paragraphs into clean email HTML
         const formatMarkdownToEmailHtml = (rawText: string) => {
            const blocks = rawText.split(/\n\n+/);
            return blocks.map(block => {
               const trimmed = block.trim();
               if (!trimmed) return "";

               // Horizontal Rule / Divider
               if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
                  return `<hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;" />`;
               }

               // Headers
               if (trimmed.startsWith("### ")) {
                  return `<h3 style="font-family: 'Newsreader', Georgia, serif; font-size: 18px; font-weight: 700; color: #18181b; margin: 20px 0 10px 0;">${trimmed.slice(4)}</h3>`;
               }
               if (trimmed.startsWith("## ")) {
                  return `<h2 style="font-family: 'Newsreader', Georgia, serif; font-size: 20px; font-weight: 800; color: #18181b; margin: 24px 0 12px 0;">${trimmed.slice(3)}</h2>`;
               }
               if (trimmed.startsWith("# ")) {
                  return `<h1 style="font-family: 'Newsreader', Georgia, serif; font-size: 22px; font-weight: 800; color: #18181b; margin: 28px 0 14px 0;">${trimmed.slice(2)}</h1>`;
               }

               // Unordered Lists
               if (trimmed.split("\n").every(line => line.trim().startsWith("- ") || line.trim().startsWith("* "))) {
                  const items = trimmed.split("\n").map(line => {
                     const itemText = line.replace(/^[-*]\s+/, "");
                     const formatted = itemText
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.*?)\*/g, "<em>$1</em>")
                        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">$1</a>');
                     return `<li style="margin-bottom: 6px; color: #3f3f46; font-size: 15px; line-height: 1.6;">${formatted}</li>`;
                  }).join("");
                  return `<ul style="padding-left: 20px; margin: 12px 0 16px 0;">${items}</ul>`;
               }

               // Callout / Blockquote
               if (trimmed.startsWith("> ")) {
                  const quoteText = trimmed.replace(/^>\s*/gm, "")
                     .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                     .replace(/\*(.*?)\*/g, "<em>$1</em>");
                  return `<div style="border-left: 3px solid #6366f1; background-color: #f8fafc; padding: 12px 16px; margin: 16px 0; border-radius: 4px; font-style: italic; color: #475569;">${quoteText.replace(/\n/g, "<br/>")}</div>`;
               }

               // Standard paragraph with bold, italic, code & link support
               let parsed = trimmed
                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  .replace(/__(.*?)__/g, "<strong>$1</strong>")
                  .replace(/\*(.*?)\*/g, "<em>$1</em>")
                  .replace(/_(.*?)_/g, "<em>$1</em>")
                  .replace(/`([^`]+)`/g, '<code style="background: #f1f5f9; color: #6366f1; padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 13px;">$1</code>')
                  .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color: #4f46e5; text-decoration: underline; font-weight: 600;">$1</a>');

               return `<p style="font-size: 15px; line-height: 1.6; color: #3f3f46; margin: 0 0 16px 0;">${parsed.replace(/\n/g, "<br/>")}</p>`;
            }).filter(Boolean).join("");
         };

         const formattedMessage = formatMarkdownToEmailHtml(messageText);

         const content = `
            <div style="margin: 8px 0 24px 0;">
               ${formattedMessage}
            </div>
            <div style="margin: 28px 0 16px 0; text-align: center;">
               <a href="${targetUrl}" class="btn-primary" style="display: inline-block; background-color: #18181b; color: #ffffff !important; font-size: 13px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.06em;">Open Variant</a>
            </div>
         `;

         const html = getEmailHtml(username, userId, title, content);
         const success = await sendEmailWithFallback(recipientEmail, title, html);

         return new Response(
            JSON.stringify({ success: !!success, action, emails_sent: success ? 1 : 0 }),
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
