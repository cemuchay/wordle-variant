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
