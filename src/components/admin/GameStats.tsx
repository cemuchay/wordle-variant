/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabaseClient";
import { CATEGORIES } from "@/wordup/shared/constants";
import { BarChart2, Cpu, Users, Target, Clock, Calendar, RefreshCw } from "lucide-react";
import { useState, useCallback, useEffect } from "react";

interface TopicStat {
    id: string;
    name: string;
    matchCount: number;
    avgPlaysPerUser: number;
    uniqueUsersCount: number;
}

const GameStats = ({ triggerToast }: { triggerToast: (text: string, type?: 'success' | 'error') => void }) => {
    const [periodDays, setPeriodDays] = useState<number>(7);
    const [inputDays, setInputDays] = useState<string>("7");
    const [loading, setLoading] = useState(false);
    
    // Stats state
    const [totalMatches, setTotalMatches] = useState<number>(0);
    const [botPct, setBotPct] = useState<number>(0);
    const [realUserPct, setRealUserPct] = useState<number>(0);
    const [asyncPct, setAsyncPct] = useState<number>(0);
    const [avgGamesPerUser, setAvgGamesPerUser] = useState<number>(0);
    const [commonTopics, setCommonTopics] = useState<TopicStat[]>([]);

    useEffect(() => {
        const handler = setTimeout(() => {
            const val = Math.max(1, Number(inputDays) || 1);
            setPeriodDays(val);
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [inputDays]);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            let allMatches: any[] = [];
            let hasMore = true;
            let page = 0;
            const pageSize = 1000;
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - periodDays);
            const dateStr = dateLimit.toISOString();

            while (hasMore) {
                const { data, error } = await supabase
                    .from('wordup_matches')
                    .select('category, is_bot_match, game_type, player1_id, player2_id, created_at')
                    .gte('created_at', dateStr)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (!data || data.length < pageSize) {
                    hasMore = false;
                }
                if (data) {
                    allMatches = [...allMatches, ...data];
                }
                page++;
            }

            const total = allMatches.length;
            setTotalMatches(total);

            if (total === 0) {
                setBotPct(0);
                setRealUserPct(0);
                setAsyncPct(0);
                setAvgGamesPerUser(0);
                setCommonTopics([]);
                return;
            }

            // Calculations
            let botCount = 0;
            let realUserCount = 0;
            let asyncCount = 0;

            const userMatchCounts: Record<string, number> = {};
            const topicUserPlays: Record<string, { totalPlays: number; users: Set<string> }> = {};
            const topicMatchCounts: Record<string, number> = {};

            allMatches.forEach((m) => {
                const isBot = !!m.is_bot_match;
                const isAsync = m.game_type === 'async';

                if (isBot) botCount++;
                else realUserCount++;

                if (isAsync) asyncCount++;

                // Track matches per category/topic
                const cat = m.category || 'unknown';
                topicMatchCounts[cat] = (topicMatchCounts[cat] || 0) + 1;

                if (!topicUserPlays[cat]) {
                    topicUserPlays[cat] = { totalPlays: 0, users: new Set() };
                }

                // Track unique users and their total games played
                if (m.player1_id) {
                    userMatchCounts[m.player1_id] = (userMatchCounts[m.player1_id] || 0) + 1;
                    topicUserPlays[cat].users.add(m.player1_id);
                    topicUserPlays[cat].totalPlays++;
                }

                if (m.player2_id && !isBot) {
                    userMatchCounts[m.player2_id] = (userMatchCounts[m.player2_id] || 0) + 1;
                    topicUserPlays[cat].users.add(m.player2_id);
                    topicUserPlays[cat].totalPlays++;
                }
            });

            // Set Pcts
            setBotPct(Math.round((botCount / total) * 100));
            setRealUserPct(Math.round((realUserCount / total) * 100));
            setAsyncPct(Math.round((asyncCount / total) * 100));

            // Avg games per unique user
            const uniqueUsers = Object.keys(userMatchCounts);
            const totalUserPlays = uniqueUsers.reduce((sum, u) => sum + userMatchCounts[u], 0);
            setAvgGamesPerUser(uniqueUsers.length > 0 ? parseFloat((totalUserPlays / uniqueUsers.length).toFixed(1)) : 0);

            // Topics list mapping
            const topicList: TopicStat[] = CATEGORIES.filter(c => c.id !== 'mixed').map(c => {
                const matchCount = topicMatchCounts[c.id] || 0;
                const playsInfo = topicUserPlays[c.id];
                const avgPlaysPerUser = playsInfo && playsInfo.users.size > 0 
                    ? parseFloat((playsInfo.totalPlays / playsInfo.users.size).toFixed(1)) 
                    : 0;
                const uniqueUsersCount = playsInfo ? playsInfo.users.size : 0;

                return {
                    id: c.id,
                    name: c.name,
                    matchCount,
                    avgPlaysPerUser,
                    uniqueUsersCount
                };
            }).sort((a, b) => b.matchCount - a.matchCount);

            setCommonTopics(topicList);

        } catch (err: any) {
            triggerToast(err.message || 'Error loading game statistics', 'error');
        } finally {
            setLoading(false);
        }
    }, [periodDays, triggerToast]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return (
        <div className="flex flex-col gap-6">
            {/* Header & Filter Card */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                        <BarChart2 className="text-correct" size={22} /> Game Statistics & Metrics
                    </h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">
                        Analyze WordUp matchmaking volumes, categories, and game modes
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5">
                        {[1, 7, 14, 30].map(days => (
                            <button
                                key={days}
                                onClick={() => setInputDays(String(days))}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    periodDays === days 
                                        ? 'bg-correct text-black shadow-md' 
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                {days === 1 ? '24 Hours' : `${days} Days`}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-xl px-3.5 py-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                        <span>Custom Days:</span>
                        <input
                            type="text"
                            value={inputDays}
                            onChange={e => setInputDays(e.target.value.replace(/\D/g, ''))}
                            className="w-14 bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-correct/50 text-center font-mono font-black"
                        />
                    </div>

                    <button
                        onClick={fetchStats}
                        disabled={loading}
                        className="text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                        title="Refresh Stats"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-24 text-center text-xs font-bold text-gray-600 uppercase tracking-widest flex items-center justify-center gap-2">
                    <RefreshCw size={16} className="animate-spin text-correct" />
                    Calculating Metrics...
                </div>
            ) : (
                <>
                    {/* Metrics Dashboard Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Total Matches Played</span>
                                <h4 className="text-3xl font-black mt-1 text-white">{totalMatches}</h4>
                            </div>
                            <div className="bg-white/5 p-3.5 rounded-xl text-gray-400 border border-white/5">
                                <Calendar size={18} />
                            </div>
                        </div>

                        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Avg Matches per User</span>
                                <h4 className="text-3xl font-black mt-1 text-correct">{avgGamesPerUser}</h4>
                            </div>
                            <div className="bg-correct/10 p-3.5 rounded-xl text-correct border border-correct/20">
                                <Users size={18} />
                            </div>
                        </div>

                        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Vs Bot Matches</span>
                                <h4 className="text-3xl font-black mt-1 text-blue-400">{botPct}%</h4>
                            </div>
                            <div className="bg-blue-500/10 p-3.5 rounded-xl text-blue-400 border border-blue-500/20">
                                <Cpu size={18} />
                            </div>
                        </div>

                        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Async Matches</span>
                                <h4 className="text-3xl font-black mt-1 text-purple-400">{asyncPct}%</h4>
                            </div>
                            <div className="bg-purple-500/10 p-3.5 rounded-xl text-purple-400 border border-purple-500/20">
                                <Clock size={18} />
                            </div>
                        </div>
                    </div>

                    {/* Lower Panels */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left: Mode Split Visualizer */}
                        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-5">
                            <div>
                                <h4 className="text-xs font-black uppercase text-white tracking-widest mb-4 flex items-center gap-2">
                                    <Target className="text-correct" size={14} /> Matchmaking Mode Splits
                                </h4>
                                <div className="space-y-4 mt-2">
                                    {/* Real User vs Bot */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                            <span>vs Real Opponent</span>
                                            <span className="text-white">{realUserPct}%</span>
                                        </div>
                                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5">
                                            <div className="bg-correct h-full rounded-full transition-all duration-500" style={{ width: `${realUserPct}%` }} />
                                        </div>
                                    </div>

                                    {/* Bot Match */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                            <span>vs AI / Bot Match</span>
                                            <span className="text-blue-400">{botPct}%</span>
                                        </div>
                                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5">
                                            <div className="bg-blue-400 h-full rounded-full transition-all duration-500" style={{ width: `${botPct}%` }} />
                                        </div>
                                    </div>

                                    {/* Async vs Live */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                            <span>Async Turn-based</span>
                                            <span className="text-purple-400">{asyncPct}%</span>
                                        </div>
                                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5">
                                            <div className="bg-purple-400 h-full rounded-full transition-all duration-500" style={{ width: `${asyncPct}%` }} />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                            <span>Live Synchronous</span>
                                            <span className="text-yellow-400">{100 - asyncPct}%</span>
                                        </div>
                                        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5">
                                            <div className="bg-yellow-400 h-full rounded-full transition-all duration-500" style={{ width: `${100 - asyncPct}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-[9px] text-gray-500 leading-relaxed font-bold uppercase tracking-wider border-t border-white/5 pt-4">
                                * Percentages represent relative shares of total matches started within the selected filter period.
                            </p>
                        </div>

                        {/* Right: Most Common Topics Table */}
                        <div className="lg:col-span-2 bg-gray-900 border border-white/10 rounded-2xl p-5">
                            <h4 className="text-xs font-black uppercase text-white tracking-widest mb-4 flex items-center gap-2">
                                <Target className="text-correct" size={14} /> Topic Match Volumes & Engagement
                            </h4>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 text-[9px] font-black uppercase tracking-wider text-gray-500">
                                            <th className="py-2.5 px-3">Topic / Category</th>
                                            <th className="py-2.5 px-3 text-right">Matches Count</th>
                                            <th className="py-2.5 px-3 text-right">Unique Users (Non-Bot)</th>
                                            <th className="py-2.5 px-3 text-right">Avg Plays / User</th>
                                            <th className="py-2.5 px-3 text-right">Share Pct</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {commonTopics.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-xs font-bold text-gray-600 uppercase tracking-widest">
                                                    No matches found in this period
                                                </td>
                                            </tr>
                                        ) : (
                                            commonTopics.map((topic) => {
                                                const share = totalMatches > 0 ? Math.round((topic.matchCount / totalMatches) * 100) : 0;
                                                return (
                                                    <tr key={topic.id} className="hover:bg-white/2 transition-all">
                                                        <td className="py-3 px-3">
                                                            <div className="font-bold text-xs text-white">{topic.name}</div>
                                                            <div className="text-[9px] text-gray-500 font-mono">ID: {topic.id}</div>
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-xs font-black text-white">
                                                            {topic.matchCount}
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-xs font-black text-correct">
                                                            {topic.uniqueUsersCount}
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-xs font-bold text-indigo-400">
                                                            {topic.avgPlaysPerUser}
                                                        </td>
                                                        <td className="py-3 px-3 text-right">
                                                            <span className="bg-black/40 border border-white/5 px-2 py-0.5 rounded text-[10px] font-black text-gray-300">
                                                                {share}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default GameStats;
