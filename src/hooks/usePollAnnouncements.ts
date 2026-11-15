import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Poll } from '../types/poll';
import { safeLocalStorage } from '../utils/storage';

const STORAGE_KEY = 'poll_announcement_seen_v1';

interface SeenPollEntry {
    lastSeenDate: string;
    expiresAt: string;
}

type SeenPollMap = Record<string, SeenPollEntry>;

function getTodayDateString(): string {
    return new Date().toISOString().slice(0, 10);
}

function readAndPruneSeenMap(activePollIds?: Set<string>): SeenPollMap {
    try {
        const raw = safeLocalStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as SeenPollMap;
        if (!parsed || typeof parsed !== 'object') {
            safeLocalStorage.removeItem(STORAGE_KEY);
            return {};
        }

        const nowMs = Date.now();
        const pruned: SeenPollMap = {};
        let changed = false;

        for (const [pollId, entry] of Object.entries(parsed)) {
            const expiresMs = entry?.expiresAt ? new Date(entry.expiresAt).getTime() : NaN;
            const isExpired = Number.isNaN(expiresMs) || expiresMs <= nowMs;
            const isNotActive = activePollIds ? !activePollIds.has(pollId) : false;

            if (isExpired || isNotActive) {
                changed = true;
                continue;
            }
            pruned[pollId] = entry;
        }

        if (changed) {
            if (Object.keys(pruned).length === 0) {
                safeLocalStorage.removeItem(STORAGE_KEY);
            } else {
                safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
            }
        }

        return pruned;
    } catch {
        safeLocalStorage.removeItem(STORAGE_KEY);
        return {};
    }
}

export function usePollAnnouncements(currentUserId?: string) {
    const [activePoll, setActivePoll] = useState<Poll | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!currentUserId) {
            return;
        }

        let cancelled = false;

        async function loadUnvotedAdminPoll() {
            const nowIso = new Date().toISOString();
            const { data: polls, error: pollsError } = await supabase
                .from('chat_polls')
                .select('*')
                .eq('is_admin_poll', true)
                .gt('expires_at', nowIso)
                .order('created_at', { ascending: false });

            if (cancelled || pollsError || !polls || polls.length === 0) {
                if (!cancelled) {
                    readAndPruneSeenMap(new Set());
                    setActivePoll(null);
                    setIsOpen(false);
                }
                return;
            }

            const pollIds = (polls as Poll[]).map((p) => p.id);
            const { data: votes, error: votesError } = await supabase
                .from('chat_poll_votes')
                .select('poll_id')
                .eq('user_id', currentUserId)
                .in('poll_id', pollIds);

            if (cancelled || votesError) return;

            const votedPollIds = new Set(((votes ?? []) as { poll_id: string }[]).map((v) => v.poll_id));
            const unvotedPolls = (polls as Poll[]).filter((p) => !votedPollIds.has(p.id));

            const unvotedIds = new Set(unvotedPolls.map((p) => p.id));
            const seenMap = readAndPruneSeenMap(unvotedIds);
            const today = getTodayDateString();

            const nextPoll = unvotedPolls.find((p) => seenMap[p.id]?.lastSeenDate !== today) ?? null;

            if (!cancelled) {
                setActivePoll(nextPoll);
                setIsOpen(Boolean(nextPoll));
            }
        }

        void loadUnvotedAdminPoll();

        return () => {
            cancelled = true;
        };
    }, [currentUserId]);

    const markPollSeenToday = useCallback(() => {
        if (activePoll) {
            const seenMap = readAndPruneSeenMap();
            seenMap[activePoll.id] = {
                lastSeenDate: getTodayDateString(),
                expiresAt: activePoll.expires_at,
            };
            safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(seenMap));
        }
        setIsOpen(false);
    }, [activePoll]);

    return {
        activePoll: currentUserId ? activePoll : null,
        isOpen: Boolean(currentUserId && isOpen),
        markPollSeenToday,
    };
}
