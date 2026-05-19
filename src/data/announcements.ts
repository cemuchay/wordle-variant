export interface Announcement {
    id: string;
    title: string;
    date: string;
    content: string;
    type: 'feature' | 'update' | 'maintenance';
}

export const ANNOUNCEMENTS: Announcement[] = [
    {
        id: 'scoring-system-revamp-v3',
        title: 'Scoring System Update! 💎',
        date: '2026-05-19',
        type: 'update',
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
        `
    },
    {
        id: 'scoring-system-v2',
        title: 'New Scoring System is Live! 🚀',
        date: '2026-05-18',
        type: 'update',
        content: `
            <h3>STARTING 18th May, 2026.</h3>
    
            <p>We've revamped our scoring system to reward discovery and punish repetitive mistakes.</p>
            
            <h3>The New Rules:</h3>
            <ul>
                <li><strong>Discovery Bonus:</strong> Finding a new letter in the correct spot (Green) now gives <strong>+40</strong> points. Finding a letter in the word but wrong spot (Yellow) gives <strong>+25</strong>. These are one-off bonuses per placement!</li>
                <li><strong>Smart Penalties:</strong> Each new incorrect letter (Black) is only <strong>-5</strong>. However, reusing a letter you already know is incorrect costs a hefty <strong>-20</strong>.</li>
                <li><strong>Hint Penalty:</strong> Using a hint now costs <strong>-100</strong> points.</li>
                <li><strong>Hint Lock:</strong> Hints are now <strong>DISABLED</strong> on your last guess or when only 1 letter remains! (will only work on guesses 2-5)</li>
            </ul>
            
            <p>Enjoy!</p>
        `
    },
    {
        id: `refresh_18052026`,
        title: "An Update Was Made!",
        date: "2026-05-18",
        content: `<p>After accepting this announcement. Please refresh the page before playing or continuing to play (better, you can close the tab and open it again)</p>`,
        type: "maintenance"
    }
];
