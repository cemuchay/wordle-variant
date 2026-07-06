/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useChallengeStore } from '../store/useChallengeStore';

interface ChallengeFiltersContextType {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    statusFilter: 'ALL' | 'ACTIVE' | 'COMPLETED';
    setStatusFilter: (f: 'ALL' | 'ACTIVE' | 'COMPLETED') => void;
    modeFilter: 'ALL' | 'LIVE' | 'ANYTIME';
    setModeFilter: (m: 'ALL' | 'LIVE' | 'ANYTIME') => void;
    lengthFilter: 'ALL' | number;
    setLengthFilter: (l: 'ALL' | number) => void;
    listColumn: 'unplayed' | 'played';
    setListColumn: (col: 'unplayed' | 'played') => void;
    clearFilters: () => void;
    filteredChallenges: any[];
    unplayedCount: number;
    openChallengesCount: number;
}

const ChallengeFiltersContext = createContext<ChallengeFiltersContextType | undefined>(undefined);

export const ChallengeFiltersProvider = ({
    children,
    myChallenges,
    openChallengeItems,
    effectiveUserId,
}: {
    children: ReactNode;
    myChallenges: any[];
    openChallengeItems: any[];
    effectiveUserId?: string | null;
}) => {
    const searchQuery = useChallengeStore(s => s.searchQuery);
    const setSearchQuery = useChallengeStore(s => s.setSearchQuery);
    const statusFilter = useChallengeStore(s => s.statusFilter);
    const setStatusFilter = useChallengeStore(s => s.setStatusFilter);
    const modeFilter = useChallengeStore(s => s.modeFilter);
    const setModeFilter = useChallengeStore(s => s.setModeFilter);
    const lengthFilter = useChallengeStore(s => s.lengthFilter);
    const setLengthFilter = useChallengeStore(s => s.setLengthFilter);
    const listColumn = useChallengeStore(s => s.listColumn);
    const setListColumn = useChallengeStore(s => s.setListColumn);
    const clearFilters = useChallengeStore(s => s.clearFilters);

    const unplayedCount = useMemo(() => {
        const activeCount = myChallenges.filter((c: any) => {
            const isBotMarathon = c.challenge?.is_bot_marathon;
            if (isBotMarathon && c.status === 'pending') return false;
            return (c.status === 'pending' || c.status === 'playing') && new Date(c.challenge.expires_at) > new Date();
        }).length;
        return activeCount + openChallengeItems.length;
    }, [myChallenges, openChallengeItems]);

    const openChallengesCount = openChallengeItems.length;

    const filteredChallenges = useMemo(() => {
        let sourceList: any[] = [];
        if (listColumn === 'unplayed') {
            const active = myChallenges.filter((item: any) => {
                const isExpired = new Date(item.challenge?.expires_at) < new Date();
                const isCompleted = item.status === 'completed' || item.status === 'timed_out' || item.status === 'declined';
                const isBotMarathon = item.challenge?.is_bot_marathon;
                if (isBotMarathon && item.status === 'pending') return false;
                return !isExpired && !isCompleted && item.status !== 'viewed';
            }).map((item: any) => ({ ...item, _section: 'active' }));
            sourceList = [...active, ...openChallengeItems.map((item: any) => ({ ...item, _section: 'open' }))];
        } else if (listColumn === 'played') {
            const played = myChallenges.filter((item: any) => {
                const isExpired = new Date(item.challenge?.expires_at) < new Date();
                const isCompleted = item.status === 'completed' || item.status === 'timed_out' || item.status === 'declined';
                return !isExpired && isCompleted && item.status !== 'viewed';
            }).map((item: any) => ({ ...item, _section: 'played' }));
            const expired = myChallenges.filter((item: any) => {
                const isExpired = new Date(item.challenge?.expires_at) < new Date();
                return isExpired;
            }).map((item: any) => ({ ...item, _section: 'expired' }));
            sourceList = [...played, ...expired];
        }

        return sourceList.filter((item: any) => {
            const challenge = item.challenge;
            if (!challenge) return false;

            if (modeFilter !== 'ALL' && challenge.mode !== modeFilter) return false;
            if (lengthFilter !== 'ALL' && challenge.word_length !== lengthFilter) return false;

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const creatorName = challenge.creator?.username?.toLowerCase() || '';
                const opponentNames = challenge.participants
                    ?.filter((p: any) => p.user_id !== effectiveUserId && p.guest_id !== effectiveUserId)
                    .map((p: any) => p.profiles?.username?.toLowerCase() || '')
                    .join(' ') || '';

                if (!creatorName.includes(query) && !opponentNames.includes(query)) return false;
            }
            return true;
        });
    }, [myChallenges, openChallengeItems, listColumn, modeFilter, lengthFilter, searchQuery, effectiveUserId]);

    const contextValue: ChallengeFiltersContextType = {
        searchQuery, setSearchQuery,
        statusFilter, setStatusFilter,
        modeFilter, setModeFilter,
        lengthFilter, setLengthFilter,
        listColumn, setListColumn,
        clearFilters,
        filteredChallenges,
        unplayedCount,
        openChallengesCount,
    };

    return (
        <ChallengeFiltersContext.Provider value={contextValue}>
            {children}
        </ChallengeFiltersContext.Provider>
    );
};

export const useChallengeFilters = () => {
    const context = useContext(ChallengeFiltersContext);
    if (context === undefined) {
        throw new Error('useChallengeFilters must be used within a ChallengeFiltersProvider');
    }
    return context;
};
