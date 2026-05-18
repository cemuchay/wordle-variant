export interface Announcement {
    id: string;
    title: string;
    date: string;
    content: string;
    type: 'feature' | 'update' | 'maintenance';
}

export const ANNOUNCEMENTS: Announcement[] = [
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
