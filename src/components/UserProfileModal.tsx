import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Phone, X, Calendar, Clock, Trophy, Flame, Zap, Award, Target, CalendarDays } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';

interface UserProfileModalProps {
    userId: string;
    onClose: () => void;
}

interface ProfileData {
    id: string;
    username: string;
    avatar_url: string;
    updated_at: string;
    last_seen_at: string;
}

interface DailyScore {
    game_date: string;
    status: string;
    skill_score: number;
    attempts: number;
}

interface ChallengeParticipation {
    id: string;
    challenge_id: string;
    user_id: string;
    status: string;
    score: number;
    attempts: number;
    completed_at: string;
    challenge?: {
        id: string;
        mode: string;
        word_length: number;
        expires_at: string;
        created_at: string;
    };
}

const getDatesInWeeksAndMonthsOf = (dates: string[]): string[] => {
    const datesSet = new Set<string>();
    
    dates.forEach(dStr => {
        // 1. Weekly: Get all 7 days of the week for this date (Mon-Sun)
        const date = new Date(dStr);
        const day = date.getDay(); // 0 = Sun, 1 = Mon, etc.
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        
        for (let i = 0; i < 7; i++) {
            const temp = new Date(date);
            temp.setDate(diff + i);
            datesSet.add(temp.toISOString().split('T')[0]);
        }
        
        // 2. Monthly: Get all days of the month for this date
        const parts = dStr.split('-');
        if (parts.length >= 2) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]); // 1-based
            const daysInMonth = new Date(year, month, 0).getDate();
            
            for (let i = 1; i <= daysInMonth; i++) {
                const formattedDay = i < 10 ? `0${i}` : `${i}`;
                const formattedMonth = month < 10 ? `0${month}` : `${month}`;
                datesSet.add(`${year}-${formattedMonth}-${formattedDay}`);
            }
        }
    });
    
    return Array.from(datesSet);
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ userId, onClose }) => {
    const { user: currentUser } = useAuth();
    const { onlineUsers, initiatePrivateCall, activeCall, triggerToast } = useApp();

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'daily' | 'challenge'>('daily');

    // Stats states
    const [dailyScores, setDailyScores] = useState<DailyScore[]>([]);
    const [allTimeScores, setAllTimeScores] = useState<{ user_id: string; game_date: string; skill_score: number }[]>([]);
    const [challengeParticipations, setChallengeParticipations] = useState<ChallengeParticipation[]>([]);
    const [allChallengeParticipations, setAllChallengeParticipations] = useState<{ challenge_id: string; user_id: string; score: number; status: string }[]>([]);
    const [currentUserChallenges, setCurrentUserChallenges] = useState<{ challenge_id: string; score: number; status: string }[]>([]);

    useEffect(() => {
        let isMounted = true;

        const fetchProfileData = async () => {
            setLoading(true);
            try {
                // 1. Fetch profile details
                const { data: edgeRes, error: profileErr } = await supabase.functions.invoke('redis-cache', {
                    body: { action: 'get-user-profile', userId }
                });

                if (profileErr) throw profileErr;
                if (isMounted && edgeRes && edgeRes.data) {
                    setProfile(edgeRes.data);
                }

                // 2. Fetch daily scores of target user
                const { data: scoresData } = await supabase
                    .from('scores')
                    .select('game_date, status, skill_score, attempts')
                    .eq('user_id', userId);

                if (scoresData && isMounted) setDailyScores(scoresData);

                // 3. Fetch all daily scores of all users for relevant dates (for awards calculations)
                let allScoresData: { user_id: string; game_date: string; skill_score: number }[] = [];
                if (scoresData && scoresData.length > 0) {
                    const targetUserWonDates = scoresData.filter(s => s.status === 'won').map(s => s.game_date);
                    if (targetUserWonDates.length > 0) {
                        const relevantDates = getDatesInWeeksAndMonthsOf(targetUserWonDates);
                        // Fetch only won scores that fall on these relevant dates
                        const { data: fetchedAllScores } = await supabase
                            .from('scores')
                            .select('user_id, game_date, skill_score')
                            .eq('status', 'won')
                            .in('game_date', relevantDates);
                        if (fetchedAllScores) {
                            allScoresData = fetchedAllScores;
                        }
                    }
                }

                if (isMounted) setAllTimeScores(allScoresData);

                // 4. Fetch challenge participations of target user
                const { data: partsData } = await supabase
                    .from('challenge_participants')
                    .select('*, challenge:challenges(*)')
                    .eq('user_id', userId);

                const validParts = (partsData || []) as ChallengeParticipation[];
                if (validParts && isMounted) setChallengeParticipations(validParts);

                // 5. Fetch all participants for the challenges target user participated in
                const challengeIds = validParts
                    .filter(p => p.status === 'completed' || p.status === 'timed_out')
                    .map(p => p.challenge_id);

                if (challengeIds.length > 0) {
                    const { data: allPartsData } = await supabase
                        .from('challenge_participants')
                        .select('challenge_id, user_id, score, status')
                        .in('challenge_id', challengeIds);

                    if (allPartsData && isMounted) setAllChallengeParticipations(allPartsData);
                }

                // 6. Fetch logged-in user's challenge participations for H2H
                if (currentUser && currentUser.id !== userId) {
                    const { data: currUserParts } = await supabase
                        .from('challenge_participants')
                        .select('challenge_id, score, status')
                        .eq('user_id', currentUser.id);

                    if (currUserParts && isMounted) setCurrentUserChallenges(currUserParts);
                }

            } catch (err) {
                console.error("Error loading profile stats:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchProfileData();

        return () => {
            isMounted = false;
        };
    }, [userId, currentUser]);

    // Helpers
    const isOnline = useMemo(() => {
        return onlineUsers.some(u => u.id === userId);
    }, [onlineUsers, userId]);

    const formatLastSeen = (dateStr: string) => {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getMondayDateString = (dateStr: string): string => {
        const date = new Date(dateStr);
        const day = date.getDay(); // 0 is Sunday, 1 is Monday, etc.
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date.setDate(diff));
        return monday.toISOString().split('T')[0];
    };

    // Computations
    const stats = useMemo(() => {
        // Daily Wordle calculations
        const played = dailyScores.length;
        const won = dailyScores.filter(s => s.status === 'won').length;
        const winPct = played > 0 ? Math.round((won / played) * 100) : 0;

        // Streaks
        const wonDates = dailyScores
            .filter(s => s.status === 'won')
            .map(s => s.game_date)
            .filter((v, i, a) => a.indexOf(v) === i)
            .sort();

        let maxStreak = 0;
        let currentStreak = 0;
        let prevDate: Date | null = null;

        for (const dStr of wonDates) {
            const currentDate = new Date(dStr);
            if (!prevDate) {
                currentStreak = 1;
            } else {
                const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    currentStreak += 1;
                } else if (diffDays > 1) {
                    if (currentStreak > maxStreak) maxStreak = currentStreak;
                    currentStreak = 1;
                }
            }
            prevDate = currentDate;
        }
        if (currentStreak > maxStreak) maxStreak = currentStreak;

        // Check if current streak is active
        if (prevDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const lastWon = new Date(prevDate);
            lastWon.setHours(0, 0, 0, 0);

            if (lastWon.getTime() !== today.getTime() && lastWon.getTime() !== yesterday.getTime()) {
                currentStreak = 0;
            }
        }

        // Guess Distribution
        const guessDist = [0, 0, 0, 0, 0, 0];
        dailyScores.forEach(s => {
            if (s.status === 'won' && s.attempts >= 1 && s.attempts <= 6) {
                guessDist[s.attempts - 1]++;
            }
        });

        // Records
        const highestDailyScore = Math.max(...dailyScores.map(s => s.skill_score || 0), 0);

        // Awards (Daily, Weekly, Monthly Leaderboard Wins)
        let dailyWins = 0;
        let weeklyWins = 0;
        let monthlyWins = 0;

        if (allTimeScores.length > 0) {
            // Group all scores by game_date
            const scoresByDate: Record<string, { user_id: string; score: number }[]> = {};
            const scoresByUserWeek: Record<string, Record<string, number>> = {}; // user_id -> weekKey -> sum
            const scoresByUserMonth: Record<string, Record<string, number>> = {}; // user_id -> monthKey -> sum

            allTimeScores.forEach(s => {
                if (!scoresByDate[s.game_date]) scoresByDate[s.game_date] = [];
                scoresByDate[s.game_date].push({ user_id: s.user_id, score: s.skill_score });

                const weekKey = getMondayDateString(s.game_date);
                const monthKey = s.game_date.substring(0, 7);

                // Weekly tracking
                if (!scoresByUserWeek[s.user_id]) scoresByUserWeek[s.user_id] = {};
                scoresByUserWeek[s.user_id][weekKey] = (scoresByUserWeek[s.user_id][weekKey] || 0) + s.skill_score;

                // Monthly tracking
                if (!scoresByUserMonth[s.user_id]) scoresByUserMonth[s.user_id] = {};
                scoresByUserMonth[s.user_id][monthKey] = (scoresByUserMonth[s.user_id][monthKey] || 0) + s.skill_score;
            });

            // Calculate Daily Wins
            Object.keys(scoresByDate).forEach(date => {
                const dayScores = scoresByDate[date];
                const maxScore = Math.max(...dayScores.map(ds => ds.score));
                const winners = dayScores.filter(ds => ds.score === maxScore).map(ds => ds.user_id);
                if (winners.includes(userId)) dailyWins++;
            });

            // Calculate Weekly Wins
            const allWeekKeys = new Set<string>();
            Object.values(scoresByUserWeek).forEach(userWeeks => {
                Object.keys(userWeeks).forEach(wk => allWeekKeys.add(wk));
            });

            allWeekKeys.forEach(weekKey => {
                let maxWeeklyScore = -1;
                const winners: string[] = [];

                Object.keys(scoresByUserWeek).forEach(uId => {
                    const weeklyScore = scoresByUserWeek[uId][weekKey] || 0;
                    if (weeklyScore > maxWeeklyScore) {
                        maxWeeklyScore = weeklyScore;
                        winners.length = 0;
                        winners.push(uId);
                    } else if (weeklyScore === maxWeeklyScore && weeklyScore > 0) {
                        winners.push(uId);
                    }
                });

                if (winners.includes(userId)) weeklyWins++;
            });

            // Calculate Monthly Wins
            const allMonthKeys = new Set<string>();
            Object.values(scoresByUserMonth).forEach(userMonths => {
                Object.keys(userMonths).forEach(mk => allMonthKeys.add(mk));
            });

            allMonthKeys.forEach(monthKey => {
                let maxMonthlyScore = -1;
                const winners: string[] = [];

                Object.keys(scoresByUserMonth).forEach(uId => {
                    const monthlyScore = scoresByUserMonth[uId][monthKey] || 0;
                    if (monthlyScore > maxMonthlyScore) {
                        maxMonthlyScore = monthlyScore;
                        winners.length = 0;
                        winners.push(uId);
                    } else if (monthlyScore === maxMonthlyScore && monthlyScore > 0) {
                        winners.push(uId);
                    }
                });

                if (winners.includes(userId)) monthlyWins++;
            });
        }

        // Challenge Calculations
        const completedChallenges = challengeParticipations.filter(p => p.status === 'completed' || p.status === 'timed_out');
        const challengesPlayed = completedChallenges.length;

        // Challenges Won
        let challengesWon = 0;
        if (completedChallenges.length > 0 && allChallengeParticipations.length > 0) {
            completedChallenges.forEach(myPart => {
                const challengeParts = allChallengeParticipations.filter(p => p.challenge_id === myPart.challenge_id && (p.status === 'completed' || p.status === 'timed_out'));
                if (challengeParts.length > 0) {
                    const maxScore = Math.max(...challengeParts.map(p => p.score));
                    const winners = challengeParts.filter(p => p.score === maxScore).map(p => p.user_id);
                    if (winners.includes(userId)) challengesWon++;
                }
            });
        }

        const totalChallengePoints = completedChallenges.reduce((sum, p) => sum + (p.score || 0), 0);

        // Weekly Challenge Points
        const startOfWeek = new Date();
        const currentDay = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const weeklyChallengePoints = completedChallenges
            .filter(p => p.completed_at && new Date(p.completed_at) >= startOfWeek)
            .reduce((sum, p) => sum + (p.score || 0), 0);

        // Head to Head (H2H) comparison
        let h2hPlayed = 0;
        let h2hWins = 0;
        let h2hLosses = 0;
        let h2hTies = 0;

        if (currentUser && currentUser.id !== userId && currentUserChallenges.length > 0 && completedChallenges.length > 0) {
            completedChallenges.forEach(targetPart => {
                const matchingCurrUserPart = currentUserChallenges.find(p => p.challenge_id === targetPart.challenge_id && (p.status === 'completed' || p.status === 'timed_out'));
                if (matchingCurrUserPart) {
                    h2hPlayed++;
                    if (targetPart.score > matchingCurrUserPart.score) {
                        h2hWins++; // target user won
                    } else if (matchingCurrUserPart.score > targetPart.score) {
                        h2hLosses++; // current user won (target user lost)
                    } else {
                        h2hTies++;
                    }
                }
            });
        }

        // Earliest join date proxy
        let memberSince = 'Recently';
        if (dailyScores.length > 0) {
            const dates = dailyScores.map(s => new Date(s.game_date).getTime());
            const earliest = new Date(Math.min(...dates));
            memberSince = earliest.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
        } else if (profile?.updated_at) {
            memberSince = new Date(profile.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
        }

        return {
            played,
            won,
            winPct,
            currentStreak,
            maxStreak,
            guessDist,
            highestDailyScore,
            dailyWins,
            weeklyWins,
            monthlyWins,
            challengesPlayed,
            challengesWon,
            totalChallengePoints,
            weeklyChallengePoints,
            h2hPlayed,
            h2hWins,
            h2hLosses,
            h2hTies,
            memberSince
        };

    }, [dailyScores, allTimeScores, challengeParticipations, allChallengeParticipations, currentUserChallenges, userId, currentUser, profile]);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-9999">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="w-full max-w-lg bg-gray-950/95 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh]"
            >
                {/* Header Profile Section */}
                <div className="p-6 border-b border-white/5 relative overflow-hidden bg-white/5">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-correct/5 blur-3xl -mr-12 -mt-12 pointer-events-none" />

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 text-gray-400 hover:text-white transition-all cursor-pointer"
                    >
                        <X size={16} />
                    </button>

                    {loading ? (
                        <div className="flex items-center gap-4 animate-pulse">
                            <div className="w-16 h-16 rounded-full bg-white/10" />
                            <div className="space-y-2">
                                <div className="h-4 w-32 bg-white/10 rounded" />
                                <div className="h-3 w-20 bg-white/10 rounded" />
                            </div>
                        </div>
                    ) : (
                        profile && (
                            <div className="flex items-center gap-5 w-full">
                                <div className="relative">
                                    <img
                                        src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}`}
                                        alt={profile.username}
                                        className={`w-16 h-16 rounded-full border-2 object-cover ${isOnline ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-white/20'}`}
                                    />
                                    {isOnline && (
                                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-gray-950" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-xl font-black text-white truncate pr-6">{profile.username}</h2>
                                    <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} className="text-correct" />
                                            Joined {stats.memberSince}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} className="text-correct" />
                                            {isOnline ? (
                                                <span className="text-emerald-400 font-black">Active Now</span>
                                            ) : (
                                                <span>Seen {formatLastSeen(profile.last_seen_at)}</span>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {isOnline && currentUser && currentUser.id !== userId && (
                                    <button
                                        onClick={() => {
                                            if (activeCall) {
                                                triggerToast("You are already in a call.", 4000);
                                                return;
                                            }
                                            initiatePrivateCall({
                                                id: profile.id,
                                                username: profile.username,
                                                avatar_url: profile.avatar_url
                                            });
                                            onClose();
                                        }}
                                        className="flex items-center justify-center p-3 bg-emerald-500 hover:bg-emerald-600 text-black rounded-full shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all mr-6"
                                        title={`Call ${profile.username}`}
                                    >
                                        <Phone size={16} />
                                    </button>
                                )}
                            </div>
                        )
                    )}
                </div>

                {loading ? (
                    <div className="flex-1 p-8 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-correct border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Tab Selector */}
                        <div className="flex border-b border-white/5 bg-gray-900/40 p-1">
                            <button
                                onClick={() => setActiveTab('daily')}
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-2xl ${activeTab === 'daily' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                            >
                                Daily Stats
                            </button>
                            <button
                                onClick={() => setActiveTab('challenge')}
                                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-2xl ${activeTab === 'challenge' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                            >
                                Challenge Stats
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">

                            {/* Head to Head (H2H) comparison - show only for other players */}
                            {currentUser && currentUser.id !== userId && stats.h2hPlayed > 0 && (
                                <div className="bg-linear-to-r from-correct/10 to-emerald-950/20 border border-correct/20 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black text-correct uppercase tracking-wider flex items-center gap-1.5">
                                            <Target size={12} /> H2H Showdown
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                                            {stats.h2hPlayed} Shared Challenge{stats.h2hPlayed > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-white/5 rounded-xl p-2.5">
                                            <div className="text-xl font-black text-white">{stats.h2hWins}</div>
                                            <div className="text-[9px] font-black uppercase text-gray-500">Wins</div>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-2.5">
                                            <div className="text-xl font-black text-gray-400">{stats.h2hTies}</div>
                                            <div className="text-[9px] font-black uppercase text-gray-500">Ties</div>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-2.5">
                                            <div className="text-xl font-black text-red-400">{stats.h2hLosses}</div>
                                            <div className="text-[9px] font-black uppercase text-gray-500">Losses</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'daily' ? (
                                <div className="space-y-6">
                                    {/* Daily statistics grid */}
                                    <div className="grid grid-cols-4 gap-3 text-center">
                                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                            <div className="text-2xl font-black text-white">{stats.played}</div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">Played</div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                            <div className="text-2xl font-black text-white">{stats.winPct}%</div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">Win Rate</div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                            <div className="text-2xl font-black text-correct flex items-center justify-center gap-1">
                                                <Flame size={20} className="fill-correct" />
                                                {stats.currentStreak}
                                            </div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">Streak</div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                            <div className="text-2xl font-black text-yellow-500">{stats.maxStreak}</div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">Max Streak</div>
                                        </div>
                                    </div>

                                    {/* Guess distribution */}
                                    <div className="space-y-2.5">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Guess Distribution</h3>
                                        <div className="space-y-2">
                                            {stats.guessDist.map((count, index) => {
                                                const maxCount = Math.max(...stats.guessDist, 1);
                                                const pct = (count / maxCount) * 100;
                                                return (
                                                    <div key={index} className="flex items-center gap-3 text-xs font-bold">
                                                        <span className="w-2.5 text-gray-500">{index + 1}</span>
                                                        <div className="flex-1 bg-white/5 h-6 rounded-md overflow-hidden relative border border-white/5">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${pct}%` }}
                                                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                                                className={`h-full flex items-center justify-end pr-2 font-mono font-bold text-[10px] text-black ${count > 0 ? 'bg-correct' : 'bg-transparent text-gray-500'}`}
                                                                style={{ minWidth: count > 0 ? '24px' : '0%' }}
                                                            >
                                                                {count}
                                                            </motion.div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Award system (badges) */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Leaderboard Awards</h3>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className={`rounded-2xl p-3 border text-center flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${stats.dailyWins > 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/5 border-white/5 opacity-40'}`}>
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/5 blur-2xl -mr-6 -mt-6 pointer-events-none" />
                                                <Award size={28} className={stats.dailyWins > 0 ? 'text-yellow-400' : 'text-gray-600'} />
                                                <div className="text-xl font-black text-white mt-1.5">{stats.dailyWins}</div>
                                                <div className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Daily Champion</div>
                                            </div>
                                            <div className={`rounded-2xl p-3 border text-center flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${stats.weeklyWins > 0 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/5 opacity-40'}`}>
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 blur-2xl -mr-6 -mt-6 pointer-events-none" />
                                                <Trophy size={28} className={stats.weeklyWins > 0 ? 'text-blue-400' : 'text-gray-600'} />
                                                <div className="text-xl font-black text-white mt-1.5">{stats.weeklyWins}</div>
                                                <div className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Weekly Master</div>
                                            </div>
                                            <div className={`rounded-2xl p-3 border text-center flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${stats.monthlyWins > 0 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/5 opacity-40'}`}>
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 blur-2xl -mr-6 -mt-6 pointer-events-none" />
                                                <Trophy size={28} className={stats.monthlyWins > 0 ? 'text-purple-400' : 'text-gray-600'} />
                                                <div className="text-xl font-black text-white mt-1.5">{stats.monthlyWins}</div>
                                                <div className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Monthly Dominator</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    {/* Challenge stats grid */}
                                    <div className="grid grid-cols-4 gap-3 text-center">
                                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                            <div className="text-2xl font-black text-white">{stats.challengesPlayed}</div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">Played</div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                            <div className="text-2xl font-black text-white">{stats.challengesWon}</div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">Won</div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                            <div className="text-2xl font-black text-correct">{stats.totalChallengePoints}</div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">All-Time PTS</div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                            <div className="text-2xl font-black text-yellow-500">{stats.weeklyChallengePoints}</div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">Weekly PTS</div>
                                        </div>
                                    </div>

                                    {/* Personal records */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Game Records</h3>
                                        <div className="space-y-2">
                                            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-correct/10 rounded-xl flex items-center justify-center text-correct border border-correct/10">
                                                        <Zap size={18} className="fill-correct" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-white">Highest Daily Score</div>
                                                        <div className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">Classic Single Wordle</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-black text-correct">{stats.highestDailyScore}</div>
                                                    <div className="text-[8px] font-black uppercase tracking-tighter text-gray-500">Points</div>
                                                </div>
                                            </div>

                                            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-500 border border-yellow-500/10">
                                                        <Trophy size={18} className="fill-yellow-500" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-white">Best Challenge Score</div>
                                                        <div className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">Custom / Random word lobbies</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-black text-yellow-500">
                                                        {challengeParticipations.length > 0
                                                            ? Math.max(...challengeParticipations.filter(p => p.challenge?.word_length !== 1).map(p => p.score || 0), 0)
                                                            : 0
                                                        }
                                                    </div>
                                                    <div className="text-[8px] font-black uppercase tracking-tighter text-gray-500">Points</div>
                                                </div>
                                            </div>

                                            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 border border-purple-500/10">
                                                        <CalendarDays size={18} />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-white">Best Marathon Score</div>
                                                        <div className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">Multi-Length Marathon Mode</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-black text-purple-500">
                                                        {challengeParticipations.length > 0
                                                            ? Math.max(...challengeParticipations.filter(p => p.challenge?.word_length === 1).map(p => p.score || 0), 0)
                                                            : 0
                                                        }
                                                    </div>
                                                    <div className="text-[8px] font-black uppercase tracking-tighter text-gray-500">Points</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
};
