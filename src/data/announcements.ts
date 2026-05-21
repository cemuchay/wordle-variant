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
];
