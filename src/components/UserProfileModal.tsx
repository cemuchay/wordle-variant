import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Phone, X, Calendar, Clock, Trophy, Flame, Zap, Award, Target, CalendarDays, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { ProtectedAvatar } from './chat/ProtectedAvatar';
import { WeeklyWrappedModal } from './WeeklyWrappedModal';
import { ProfileSkeleton } from './common/Skeletons';
import formatLastSeen from '../utils/formatLastSeen';
interface UserProfileModalProps {
    userId: string;
    onClose: () => void;
}

interface ProfileData {
    id: string;
    username: string;
    full_name?: string;
    avatar_url: string;
    updated_at: string;
    last_seen_at: string;
    daily_wins?: number;
    weekly_wins?: number;
    monthly_wins?: number;
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

import { useAppStore } from '../store/useAppStore';

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ userId, onClose }) => {
    const { user: currentUser } = useAuth();
    const setPendingDMUserId = useAppStore(s => s.setPendingDMUserId);
    const { onlineUsers, initiatePrivateCall, activeCall, triggerToast, date, setIsChatOpen } = useApp();
    const [isWrappedOpen, setIsWrappedOpen] = useState(false);
    const [avatarClicks, setAvatarClicks] = useState(0);

    const handleAvatarClick = () => {
        setAvatarClicks(prev => {
            if (prev + 1 >= 3) {
                setIsWrappedOpen(true);
                return 0;
            }
            return prev + 1;
        });
    };

    useEffect(() => {
        if (avatarClicks > 0) {
            const timer = setTimeout(() => setAvatarClicks(0), 1500);
            return () => clearTimeout(timer);
        }
    }, [avatarClicks]);

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'daily' | 'challenge'>('daily');

    // Stats states
    const [dailyScores, setDailyScores] = useState<DailyScore[]>([]);
    const [challengeParticipations, setChallengeParticipations] = useState<ChallengeParticipation[]>([]);
    const [allChallengeParticipations, setAllChallengeParticipations] = useState<{ challenge_id: string; user_id: string; score: number; status: string }[]>([]);
    const [currentUserChallenges, setCurrentUserChallenges] = useState<{ challenge_id: string; score: number; status: string }[]>([]);

    useEffect(() => {
        let isMounted = true;

        const fetchProfileData = async () => {
            setLoading(true);
            try {
                // 1. Kick off both network requests concurrently
                const edgePromise = supabase.functions.invoke('redis-cache', {
                    body: { action: 'get-user-profile', userId }
                });

                // 2. Fetch the pre-aggregated data from your security-compliant view
                const viewPromise = supabase
                    .from('user_dashboard_stats')
                    .select('daily_scores, challenge_participations, all_challenge_participations')
                    .eq('user_id', userId)
                    .single();

                // 3. Conditional Head-to-Head request (only if viewing another user's profile)
                const h2hPromise = (currentUser && currentUser.id !== userId)
                    ? supabase
                        .from('challenge_participants')
                        .select('challenge_id, score, status')
                        .eq('user_id', currentUser.id)
                    : Promise.resolve({ data: null, error: null });

                // Fire all requests in parallel
                const [edgeResult, viewResult, h2hResult] = await Promise.all([
                    edgePromise,
                    viewPromise,
                    h2hPromise
                ]);

                // Error Handling
                if (edgeResult.error) throw edgeResult.error;
                if (viewResult.error) throw viewResult.error;

                // Commit to state only if component is still mounted
                if (isMounted) {
                    if (edgeResult.data?.data) {
                        setProfile(edgeResult.data.data);
                    }

                    // The view returns clean arrays directly mapping to your states
                    if (viewResult.data) {
                        setDailyScores(viewResult.data.daily_scores);
                        setChallengeParticipations(viewResult.data.challenge_participations);
                        setAllChallengeParticipations(viewResult.data.all_challenge_participations);
                    }

                    if (h2hResult.data) {
                        setCurrentUserChallenges(h2hResult.data);
                    }
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
        const dailyWins = profile?.daily_wins || 0;
        const weeklyWins = profile?.weekly_wins || 0;
        const monthlyWins = profile?.monthly_wins || 0;

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

    }, [dailyScores, challengeParticipations, allChallengeParticipations, currentUserChallenges, userId, currentUser, profile]);

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
                                <div className="relative cursor-pointer" onClick={handleAvatarClick} title="Double tap? No, triple tap for a surprise!">
                                    <ProtectedAvatar
                                        userId={profile.id}
                                        src={profile.avatar_url}
                                        username={profile.username}
                                        className={`w-16 h-16 rounded-full border-2 ${isOnline ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-white/20'}`}
                                    />
                                    {isOnline && (
                                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-gray-950" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-lg sm:text-xl font-black text-white truncate pr-6">@{profile.username}</h2>
                                    {profile.full_name && (
                                        <div className="text-[11px] font-bold text-gray-500 mt-0.5">{profile.full_name}</div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-y-1 gap-x-2 sm:gap-x-3 text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={11} className="text-correct" />
                                            Joined {stats.memberSince}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={11} className="text-correct" />
                                            {isOnline ? (
                                                <span className="text-emerald-400 font-black">Active Now</span>
                                            ) : (
                                                <span>Seen {formatLastSeen(profile.last_seen_at)}</span>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {currentUser && currentUser.id !== userId && (
                                    <div className="flex items-center gap-2 mr-6 shrink-0">
                                        <button
                                            onClick={() => {
                                                setPendingDMUserId(profile.id);
                                                setIsChatOpen(true);
                                                onClose();
                                            }}
                                            className="flex items-center justify-center p-2.5 sm:p-3 bg-white/10 hover:bg-white/20 text-white rounded-full shadow-lg hover:scale-105 transition-all"
                                            title={`Message ${profile.username}`}
                                        >
                                            <MessageCircle size={14} className="sm:w-4 sm:h-4" />
                                        </button>

                                        {isOnline && (
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
                                                className="flex items-center justify-center p-2.5 sm:p-3 bg-emerald-500 hover:bg-emerald-600 text-black rounded-full shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all"
                                                title={`Call ${profile.username}`}
                                            >
                                                <Phone size={14} className="sm:w-4 sm:h-4" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </div>

                {/* Tab Selector */}
                <div className="flex border-b border-white/5 bg-gray-900/40 p-1 shrink-0">
                    <button
                        onClick={() => !loading && setActiveTab('daily')}
                        className={`flex-1 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-2xl ${activeTab === 'daily' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Daily Stats
                    </button>
                    <button
                        onClick={() => !loading && setActiveTab('challenge')}
                        className={`flex-1 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-2xl ${activeTab === 'challenge' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Challenge Stats
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 scrollbar-hide">
                    {loading ? (
                        <ProfileSkeleton />
                    ) : (
                        <>

                            {/* Head to Head (H2H) comparison - show only for other players */}
                            {currentUser && currentUser.id !== userId && stats.h2hPlayed > 0 && (
                                <div className="bg-linear-to-r from-correct/10 to-emerald-950/20 border border-correct/20 rounded-2xl p-3 sm:p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[9px] sm:text-[10px] font-black text-correct uppercase tracking-wider flex items-center gap-1.5">
                                            <Target size={11} className="sm:w-3 sm:h-3" /> H2H Showdown
                                        </span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase">
                                            {stats.h2hPlayed} Shared Challenge{stats.h2hPlayed > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-white/5 rounded-xl p-2 sm:p-2.5">
                                            <div className="text-lg sm:text-xl font-black text-white">{stats.h2hWins}</div>
                                            <div className="text-[8px] sm:text-[9px] font-black uppercase text-gray-500">They won</div>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-2 sm:p-2.5">
                                            <div className="text-lg sm:text-xl font-black text-gray-400">{stats.h2hTies}</div>
                                            <div className="text-[8px] sm:text-[9px] font-black uppercase text-gray-500">Ties</div>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-2 sm:p-2.5">
                                            <div className="text-lg sm:text-xl font-black text-green-500">{stats.h2hLosses}</div>
                                            <div className="text-[8px] sm:text-[9px] font-black uppercase text-gray-500">You won</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'daily' ? (
                                <div className="space-y-5 sm:space-y-6">
                                    {/* Daily statistics grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-center">
                                        <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                                            <div className="text-xl sm:text-2xl font-black text-white">{stats.played}</div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">Played</div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                                            <div className="text-xl sm:text-2xl font-black text-white">{stats.winPct}%</div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">Win Rate</div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                                            <div className="text-xl sm:text-2xl font-black text-correct flex items-center justify-center gap-1">
                                                <Flame size={16} className="fill-correct sm:w-5 sm:h-5" />
                                                {stats.currentStreak}
                                            </div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">Streak</div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                                            <div className="text-xl sm:text-2xl font-black text-yellow-500">{stats.maxStreak}</div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">Max Streak</div>
                                        </div>
                                    </div>

                                    {/* Guess distribution */}
                                    <div className="space-y-2">
                                        <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400">Guess Distribution</h3>
                                        <div className="space-y-1.5 sm:space-y-2">
                                            {stats.guessDist.map((count, index) => {
                                                const maxCount = Math.max(...stats.guessDist, 1);
                                                const pct = (count / maxCount) * 100;
                                                return (
                                                    <div key={index} className="flex items-center gap-2.5 sm:gap-3 text-xs font-bold">
                                                        <span className="w-2 text-gray-500 text-[10px] sm:text-xs">{index + 1}</span>
                                                        <div className="flex-1 bg-white/5 h-5 sm:h-6 rounded-md overflow-hidden relative border border-white/5">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${pct}%` }}
                                                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                                                className={`h-full flex items-center justify-end pr-2 font-mono font-bold text-[11px] sm:text-[12px] text-white ${count > 0 ? 'bg-correct' : 'bg-transparent text-gray-500'}`}
                                                                style={{ minWidth: count > 0 ? '20px' : '0%' }}
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
                                    <div className="space-y-2">
                                        <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-gray-400">Leaderboard Awards</h3>
                                        <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                            <div className={`rounded-2xl p-2 sm:p-3 border text-center flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${stats.dailyWins > 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/5 border-white/5 opacity-40'}`}>
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/5 blur-2xl -mr-6 -mt-6 pointer-events-none" />
                                                <Award size={24} className={`${stats.dailyWins > 0 ? 'text-yellow-400' : 'text-gray-600'} sm:w-7 sm:h-7`} />
                                                <div className="text-lg sm:text-xl font-black text-white mt-1">{stats.dailyWins}</div>
                                                <div className="text-[7px] sm:text-[8px] font-black uppercase text-gray-400 tracking-wider text-ellipsis overflow-hidden whitespace-nowrap w-full">Daily Champion</div>
                                            </div>
                                            <div className={`rounded-2xl p-2 sm:p-3 border text-center flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${stats.weeklyWins > 0 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/5 opacity-40'}`}>
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 blur-2xl -mr-6 -mt-6 pointer-events-none" />
                                                <Trophy size={24} className={`${stats.weeklyWins > 0 ? 'text-blue-400' : 'text-gray-600'} sm:w-7 sm:h-7`} />
                                                <div className="text-lg sm:text-xl font-black text-white mt-1">{stats.weeklyWins}</div>
                                                <div className="text-[7px] sm:text-[8px] font-black uppercase text-gray-400 tracking-wider text-ellipsis overflow-hidden whitespace-nowrap w-full">Weekly Master</div>
                                            </div>
                                            <div className={`rounded-2xl p-2 sm:p-3 border text-center flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${stats.monthlyWins > 0 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/5 opacity-40'}`}>
                                                <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 blur-2xl -mr-6 -mt-6 pointer-events-none" />
                                                <Trophy size={24} className={`${stats.monthlyWins > 0 ? 'text-purple-400' : 'text-gray-600'} sm:w-7 sm:h-7`} />
                                                <div className="text-lg sm:text-xl font-black text-white mt-1">{stats.monthlyWins}</div>
                                                <div className="text-[7px] sm:text-[8px] font-black uppercase text-gray-400 tracking-wider text-ellipsis overflow-hidden whitespace-nowrap w-full">Monthly Dominator</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300">
                                    {/* Challenge stats grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-center">
                                        <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                                            <div className="text-xl sm:text-2xl font-black text-white">{stats.challengesPlayed}</div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">Played</div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                                            <div className="text-xl sm:text-2xl font-black text-white">{stats.challengesWon}</div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">Won</div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                                            <div className="text-xl sm:text-2xl font-black text-correct">{stats.totalChallengePoints}</div>
                                            <div className="text-[8px] font-black uppercase text-gray-500 mt-1">All-Time PTS</div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/5">
                                            <div className="text-xl sm:text-2xl font-black text-yellow-500">{stats.weeklyChallengePoints}</div>
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
                                                        <div className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">Classic Single Mode</div>
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

                        </>
                    )}
                </div>
            </motion.div>
            {isWrappedOpen && (
                <WeeklyWrappedModal
                    isOpen={isWrappedOpen}
                    onClose={() => setIsWrappedOpen(false)}
                    userId={userId}
                    isEasterEgg={true}
                    gameDate={date as string}
                />
            )}
        </div>
    );
};
