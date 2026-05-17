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
    
            <p>We've revamped our scoring system to reward discovery and punish repetitive mistakes. The "Skill Index" is now more dynamic and reflective of your strategic play.</p>
            
            <h3>The New Rules:</h3>
            <ul>
                <li><strong>Discovery Bonus:</strong> Finding a letter in the correct spot (Green) now gives <strong>+40</strong> points. Finding a letter in the word but wrong spot (Yellow) gives <strong>+25</strong>. These are one-off bonuses per placement!</li>
                <li><strong>Smart Penalties:</strong> Each new incorrect letter (Black) is only <strong>-5</strong>. However, reusing a letter you already know is incorrect costs a hefty <strong>-20</strong>.</li>
                <li><strong>Hint Penalty:</strong> Using a hint now costs <strong>-100</strong> points.</li>
                <li><strong>Fail Protection:</strong> Base performance for a lost game is now <strong>0</strong> points.</li>
            </ul>

            <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin: 12px 0; border-left: 4px solid var(--primary);">
                <h4>Sample Comparison:</h4>
                <p>Imagine you win in 3 tries, discovering 5 letters and making 4 new mistakes.</p>
                <p><strong>Old System:</strong> ~750 points</p>
                <p><strong>New System:</strong> ~800+ points (Higher rewards for discovery!)</p>
            </div>
            
            <p>Enjoy!</p>
        `
    }
];
