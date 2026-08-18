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
      id: "nearly-got-it-bonus",
      title: "Scoring Update: Nearly Got It Bonus (+84 pts)",
      date: "2026-08-18",
      type: "feature",
      lifespanDays: 7,
      content: `
             <h3>1 Letter Away? We've Got You Covered!</h3>
             <p>Ever guessed <strong>HILLY</strong> only for the answer to be <strong>BILLY</strong>, dropping your base attempt score?</p>
             <p>Starting <strong>August 18th</strong> (effective from <strong>August 17th</strong>), if you achieve all green letters except one in any earlier guess and go on to win, you are awarded an extra <strong>+84 points</strong> (half of the per-level base point drop) as a <em>Nearly Got It</em> bonus.</p>
             <p>All retroactive scores from August 17th onwards will reflect this update automatically.</p>
         `,
   },
   {
      id: "customizable-suername",
      title: "",
      date: "2026-07-04",
      type: "update",
      content: `
             <h3>you can now change your in-app username (must be unique, of course)</h3>
             <p> your username is customizable in the settings page (top right), after editing, ensure to save </p>
         `,
   },
];
