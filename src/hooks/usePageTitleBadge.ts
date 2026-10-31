import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useApp } from '../context/AppContext';
import { useNotifications } from './useNotifications';

const DEFAULT_TITLE = 'Variant - Multiplayer Word Game, WordUp Trivia & Daily Word Challenges';
const DEFAULT_DESCRIPTION = 'Variant is a free multiplayer word game and trivia platform. Play daily word puzzles, live 1v1 WordUp trivia battles, WordGrid puzzles, and bot marathons with friends.';
const BASE_ORIGIN = 'https://wordle-variant.xyz';

const ROUTE_SEO: Record<string, { title: string; description: string; canonicalPath: string }> = {
    '/wordup': {
        title: 'WordUp Trivia & Vocabulary Battles | Variant Multiplayer Word Game',
        description: 'Challenge friends or bots in WordUp 1v1 live and asynchronous trivia battles across vocabulary, idioms, science, geography, and general knowledge.',
        canonicalPath: '/wordup',
    },
    '/wordgrid': {
        title: 'WordGrid Tactical Crossword Puzzle | Variant Multiplayer Word Game',
        description: 'Play WordGrid on Variant — build intersecting words on a shared tactical crossword board against friends or AI opponents.',
        canonicalPath: '/wordgrid',
    },
    '/word-grid': {
        title: 'WordGrid Tactical Crossword Puzzle | Variant Multiplayer Word Game',
        description: 'Play WordGrid on Variant — build intersecting words on a shared tactical crossword board against friends or AI opponents.',
        canonicalPath: '/wordgrid',
    },
    '/challenges': {
        title: 'Multiplayer Word Challenges & Bot Marathons | Variant',
        description: 'Compete in custom multiplayer word challenges, daily AI bot marathons, and real-time word races with friends on Variant.',
        canonicalPath: '/challenges',
    },
    '/leaderboard': {
        title: 'Global Word Puzzle Leaderboard & Player Stats | Variant',
        description: 'View the daily and weekly global leaderboards, player streaks, speed bonuses, and social stats on Variant.',
        canonicalPath: '/leaderboard',
    },
};

export const usePageTitleBadge = (wordupUnreadCount: number) => {
    const { profile } = useApp();
    const { unreadCount: notificationUnread } = useNotifications(profile?.id, { enableRealtime: false });
    const chatUnread = useAppStore(s => s.unreadCount);
    const challengeUnread = useAppStore(s => s.challengeUnreadCount);
    const isWordUpOpen = useAppStore(s => s.isWordUpOpen);
    const isChallengeOpen = useAppStore(s => s.isChallengeOpen);
    const isStatsOpen = useAppStore(s => s.isStatsOpen);

    useEffect(() => {
        const rawPath = typeof window !== 'undefined' ? window.location.pathname.toLowerCase().replace(/\/$/, '') : '';
        const routeMeta = ROUTE_SEO[rawPath];

        const baseTitle = routeMeta?.title || DEFAULT_TITLE;
        const description = routeMeta?.description || DEFAULT_DESCRIPTION;
        const canonicalHref = `${BASE_ORIGIN}${routeMeta?.canonicalPath || '/'}`;

        const descEl = document.querySelector('meta[name="description"]');
        if (descEl) descEl.setAttribute('content', description);

        const canonicalEl = document.querySelector('link[rel="canonical"]');
        if (canonicalEl) canonicalEl.setAttribute('href', canonicalHref);

        const otherUnread = notificationUnread + challengeUnread + wordupUnreadCount;
        const parts: string[] = [];

        if (chatUnread > 0) {
            parts.push(`💬 ${chatUnread > 99 ? '99+' : chatUnread}`);
        }

        if (otherUnread > 0) {
            parts.push(`🔔 ${otherUnread > 99 ? '99+' : otherUnread}`);
        }

        if (parts.length > 0) {
            document.title = `(${parts.join(' | ')}) ${baseTitle}`;
        } else {
            document.title = baseTitle;
        }
    }, [chatUnread, notificationUnread, challengeUnread, wordupUnreadCount, isWordUpOpen, isChallengeOpen, isStatsOpen]);
};
