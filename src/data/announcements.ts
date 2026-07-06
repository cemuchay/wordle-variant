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
      id: "scoring-system-update-july-2026",
      title: "New Scoring & Regression System!",
      date: "2026-07-06",
      type: "update",
      content: `
         <h3>We have updated the Skill Index scoring engine and introduced regression play penalties starting today (6th July, 2026):</h3>
         
         <h4 style="color:#818cf8; margin-top:12px; font-weight:700;">Revised Letter Value System:</h4>
         <ul style="list-style-type:disc; padding-left:20px; margin-bottom:12px;">
            <li><strong>1st Attempt</strong>: Green +65, Yellow +50</li>
            <li><strong>2nd Attempt</strong>: Green +55, Yellow +40</li>
            <li><strong>3rd Attempt</strong>: Green +45, Yellow +30</li>
            <li><strong>4th Attempt</strong>: Green +35, Yellow +20</li>
            <li><strong>5th Attempt</strong>: Green +25, Yellow +15</li>
            <li><strong>6th Attempt</strong>: Green +20, Yellow +10</li>
         </ul>

         <h4 style="color:#f87171; margin-top:12px; font-weight:700;">Regression Play Penalties:</h4>
         <ul style="list-style-type:disc; padding-left:20px; margin-bottom:12px;">
            <li><strong>Green to Black (-15 pts)</strong>: Changing a previously solved Green letter to a Black (absent) letter in the same spot.</li>
            <li><strong>Yellow to Black (-10 pts)</strong>: Completely omitting a previously found Yellow letter in a later guess.</li>
            <li><strong>Green to Yellow (-5 pts)</strong>: Moving a previously solved Green letter out of its correct spot into a different Yellow spot.</li>
            <li><strong>Yellow same spot (-5 pts)</strong>: Placing a Yellow letter in the exact same wrong spot again.</li>
         </ul>
         <p style="color:#9ca3af; font-size:12px; margin-top:12px;">These changes encourage tactical play and discourage mindless guesses of already resolved/absent letters!</p>
      `,
   },
];
