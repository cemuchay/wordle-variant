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
      id: "scoring-system-revamp-v3",
      title: "Scoring System Update! 💎",
      date: "2026-05-19",
      type: "update",
      content: `
            <h3>The Ultimate Skill Index Update!</h3>
    
            <p>The Skill Index calculation has been updated to better reward strategic brilliance and early game intuition.</p>
            
            <h3>What's New?</h3>
            <ul>
                <li><strong>Transparent Explanations:</strong> You can now see exactly how every single letter you play affects your score! Just click on any player's guesses to see the row-by-row breakdown.</li>
                <li><strong>Early Bird Rewards:</strong> 
                    <ul>
                        <li><strong>1st Try:</strong> Green discoveries give <strong>+60</strong>, Yellows give <strong>+35</strong>.</li>
                        <li><strong>2nd Try:</strong> Green discoveries give <strong>+50</strong>, Yellows give <strong>+30</strong>.</li>
                        <li><strong>Standard:</strong> Subsequent discoveries give +40 (Green) and +25 (Yellow).</li>
                    </ul>
                </li>
                <li><strong>Discovery Logic:</strong> Points are awarded once per unique letter discovery. Strategic reuse of known information is key!</li>
                <li><strong>Strategic Penalties:</strong> Fresh incorrect letters (Black) are <strong>-5</strong>, but repeating a known incorrect letter is a heavy <strong>-20</strong> penalty.</li>
            </ul>
            
            <p>This change will retoractively apply to yesterday, 18th May 2026, so this week is consistent</p>
        `,
   },
   {
      id: "marathon-games-list-revamp",
      title: "Marathon Game Selection Revamp! 🏃‍♂️💨",
      date: "2026-06-04",
      type: "update",
      content: `
            <h3>Better Marathon & Daily Challenge Navigation!</h3>
            <p>We've redesigned the marathon games list to make playing through large sets of words feel much more seamless.</p>
            
            <h3>What's New?</h3>
            <ul>
                <li><strong>Intelligent "Next Up" Game:</strong> The first unlocked, unplayed game is now automatically displayed right at the top for instant play. No more scrolling down to find where you left off!</li>
                <li><strong>Categorization Filters:</strong> Quickly toggle the game list view between <strong>All</strong>, <strong>Unplayed</strong>, and <strong>Played / Timed Out</strong> games.</li>
                <li><strong>Daily Event Tabs:</strong> Daily marathon challenges are now organized by days (Day 1, Day 2, etc.), defaulting automatically to the current active day.</li>
            </ul>
        `,
   },
   {
      id: "challenge-mode-fixes-v1",
      title: "Challenge Mode Fixed! 🛠️",
      date: "2026-06-06",
      type: "update",
      lifespanDays: 7,
      content: `
            <h3>Bugs Squashed!</h3>
            <p>We've successfully squashed several visual glitches and layout bugs in Challenge Mode gameplay. The updates have been rigorously tested across an array of different devices and browsers to ensure a seamless experience.</p>
            <p>If you run into any other issues, or have ideas for features, please let us know in the <strong>Chat -> Bugs & Features</strong> group!</p>
            <p>Happy playing!</p>
        `,
   },
   {
      id: "daily-cycle-length-update",
      title: "Daily Game Update! 📅",
      date: "2026-06-07",
      type: "update",
      content: `
            <h3>Refreshing the Daily Cycle!</h3>
            <p>Starting from <strong>June 8th, 2026</strong>, we are making a small shift to the daily word selection loop to keep things challenging and engaging.</p>
            
            <h3>What's Changing?</h3>
            <ul>
                <li><strong>3-Letter Words Retired:</strong> 3-letter words are being removed from the main daily game cycle. They'll still be available in challenge mode.</li>
                <li><strong>Updated Distribution:</strong> The daily loop will now focus exclusively on 4, 5, 6, and 7 letter words, providing a more consistent experience.</li>
            </ul>
            <p>Goodluck in the new week!</p>
        `,
   },
];
