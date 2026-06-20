export interface Announcement {
   id: string;
   title: string;
   date: string;
   content: string;
   type: "feature" | "update" | "maintenance";
   lifespanDays?: number;
}

export const ANNOUNCEMENTS: Announcement[] = [
   {
      id: "pwa-install-and-settings-update-v1",
      title: "Go Native: Install the Variant PWA! 📱",
      date: "2026-06-16",
      type: "feature",
      content: `
             <h3>Unlock the Full Variant Experience</h3>
             <p>You can now install Variant as a Progressive Web App (PWA) on your device for a more seamless, native-like experience.</p>
             
             <h3>Why Install?</h3>
             <ul>
                 <li><strong>Native Feel:</strong> Enjoy a distraction-free, fullscreen interface without browser bars.</li>
                 <li><strong>Push Notifications:</strong> Get real-time alerts for word challenges, mentions in chat, and game reminders directly on your home screen.</li>
                 <li><strong>Faster Access:</strong> Launch Variant instantly from your home screen or dock.</li>
             </ul>

             <h3>How to Install?</h3>
             <ul>
                 <li><strong>iOS:</strong> Tap the <strong>Share</strong> button in Safari and select <strong>"Add to Home Screen"</strong>.</li>
                 <li><strong>Android / Chrome:</strong> Look for the <strong>"Install App"</strong> banner or select it from the browser menu.</li>
             </ul>

             <h3>New Settings Features 🛠️</h3>
             <p>We've also added more control to your <strong>Settings</strong>:</p>
             <ul>
                 <li><strong>Push Notification Toggle:</strong> Easily manage your notification preferences.</li>
                 <li><strong>Compact Mode:</strong> A new toggle to reduce spacing in the game grid, perfect for smaller screens or high-speed play.</li>
                 <li><strong>Purge Cache & Reload:</strong> If the app feels stuck or out of date, use this new tool in <em>Diagnostics</em> to perform a deep refresh of all local data.</li>
             </ul>
         `,
   },
   {
      id: "wordup-beta-launch",
      title: "WordUp Battles Are Here! ⚔️",
      date: "2026-06-20",
      type: "feature",
      lifespanDays: 7,
      content: `
             <h3>test your wits in real time word battles</h3>
             <p><strong>WordUp</strong> is a head to head word game where you and an opponent race through 7 rapid fire questions. Think fast & correct answers and speed both earn points, with double points on the final round!</p>
             
             <h3>How to Play</h3>
             <ul>
                 <li>Head to the <strong>WordUp</strong> tab in the navigation bar.</li>
                 <li>Choose <strong>"Search Opponent"</strong> to get matched instantly, or invite a friend from the online player list.</li>
                 <li>Answer 7 mixed questions — anagrams, definitions, pattern puzzles, and more  before time runs out.</li>
             </ul>
             <p>WordUp is currently in <strong>Beta</strong>. Your feedback helps shape the experience — drop suggestions in <strong>Chat → Bugs & Features</strong>.</p>

             <hr style="border-color: #333; margin: 1rem 0;">

             <h3>Customize Your Navigation</h3>
             <p>You can now reorder and toggle the visibility of app navigation menus in <strong>Settings → Navigation Order</strong></p>
         `,
   },
];
