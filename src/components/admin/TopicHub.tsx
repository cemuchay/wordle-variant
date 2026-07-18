/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabaseClient";
import { CATEGORIES } from "@/wordup/shared/constants";
import { BookOpen, RefreshCw, Search } from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { getQuestionConfig } from "../../../supabase/functions/generate-match-questions/questionConfig";

const VARIANT_NAMES = [
    "Forward (Q -> A)",
    "Reverse (A -> Q)",
    "Odd One Out",
    "True/False",
    "Multi-Clue",
    "Correct Error",
    "Tag Match",
    "Compare",
    "Timeline",
];
const LEVEL_COLORS: Record<number, string> = {
    1: 'text-blue-400',
    2: 'text-teal-400',
    3: 'text-yellow-400',
    4: 'text-orange-400',
    5: 'text-red-400',
};

const TopicHub = ({ triggerToast }: { triggerToast: (text: string, type?: 'success' | 'error') => void }) => {
    // Structure: { [category]: { total: number, levels: Record<number, number> } }
    const [counts, setCounts] = useState<Record<string, { total: number; levels: Record<number, number> }>>({});
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [modeFilter, setModeFilter] = useState<'all' | 'procedural' | 'handcrafted' | 'hybrid'>('all');

    const fetchCounts = useCallback(async () => {
        setLoading(true);
        try {
            const categories = CATEGORIES.filter(c => c.id !== 'mixed');
            const newCounts: Record<string, { total: number; levels: Record<number, number> }> = {};
            
            await Promise.all(categories.map(async (cat) => {
                const [totalRes, l1, l2, l3, l4, l5] = await Promise.all([
                    supabase.from('wordup_handcrafted_questions').select('*', { count: 'exact', head: true }).eq('category', cat.id),
                    supabase.from('wordup_handcrafted_questions').select('*', { count: 'exact', head: true }).eq('category', cat.id).eq('difficulty', 1),
                    supabase.from('wordup_handcrafted_questions').select('*', { count: 'exact', head: true }).eq('category', cat.id).eq('difficulty', 2),
                    supabase.from('wordup_handcrafted_questions').select('*', { count: 'exact', head: true }).eq('category', cat.id).eq('difficulty', 3),
                    supabase.from('wordup_handcrafted_questions').select('*', { count: 'exact', head: true }).eq('category', cat.id).eq('difficulty', 4),
                    supabase.from('wordup_handcrafted_questions').select('*', { count: 'exact', head: true }).eq('category', cat.id).eq('difficulty', 5),
                ]);

                newCounts[cat.id] = {
                    total: totalRes.count || 0,
                    levels: {
                        1: l1.count || 0,
                        2: l2.count || 0,
                        3: l3.count || 0,
                        4: l4.count || 0,
                        5: l5.count || 0,
                    }
                };
            }));

            setCounts(newCounts);
        } catch (err: any) {
            triggerToast(err.message || 'Error fetching question counts', 'error');
        } finally {
            setLoading(false);
        }
    }, [triggerToast]);

    useEffect(() => {
        Promise.resolve().then(() => {
            fetchCounts();
        });
    }, [fetchCounts]);

    const activeTopics = useMemo(() => {
        const filtered = CATEGORIES.filter(c => c.id !== 'mixed');

        return filtered.map(c => {
            const config = getQuestionConfig(c.id);
            const poolData = counts[c.id] || { total: 0, levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
            const poolCount = poolData.total;

            let model: 'procedural' | 'handcrafted' | 'hybrid' = 'hybrid';
            if (config.proceduralWeight === 1.0) {
                model = 'procedural';
            } else if (config.proceduralWeight === 0.0) {
                model = 'handcrafted';
            }

            return {
                ...c,
                config,
                poolCount,
                poolData,
                model,
            };
        });
    }, [counts]);

    const filteredTopics = useMemo(() => {
        return activeTopics.filter(t => {
            if (modeFilter !== 'all' && t.model !== modeFilter) return false;

            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
            }

            return true;
        });
    }, [activeTopics, modeFilter, searchQuery]);

    const getModelBadgeColor = (model: string) => {
        if (model === 'procedural') return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
        if (model === 'handcrafted') return 'bg-green-500/10 border-green-500/30 text-green-400';
        return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                            <BookOpen className="text-correct" size={22} /> Topic Stats & Configurations
                        </h3>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">
                            Inspect how each Arena category generates its gameplay questions
                        </p>
                    </div>
                    <button
                        onClick={fetchCounts}
                        disabled={loading}
                        className="text-gray-400 hover:text-white p-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                        title="Refresh database counts"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative sm:col-span-2">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                        <input
                            type="text"
                            placeholder="Filter by name, ID or description..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs focus:outline-none focus:border-correct/50 transition-all text-white placeholder-gray-600"
                        />
                    </div>

                    <select
                        value={modeFilter}
                        onChange={e => setModeFilter(e.target.value as any)}
                        className="bg-black/40 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-correct/50 text-white"
                    >
                        <option value="all" className="bg-gray-900 text-white">All Generation Models</option>
                        <option value="procedural" className="bg-gray-900 text-white">Procedural-Only</option>
                        <option value="handcrafted" className="bg-gray-900 text-white">Handcrafted-Only</option>
                        <option value="hybrid" className="bg-gray-900 text-white">Hybrid (Procedural + Pool)</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredTopics.map(t => {
                    const weightSum = t.config.variantWeights.reduce((a, b) => a + b, 0);

                    return (
                        <div key={t.id} className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-5">
                            <div>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h4 className="text-base font-black text-white leading-tight">{t.name}</h4>
                                        <span className="font-mono text-[9px] text-gray-500 block mt-0.5">ID: {t.id}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 border rounded-md text-[9px] font-black uppercase tracking-wider ${getModelBadgeColor(t.model)}`}>
                                        {t.model === 'procedural' ? 'Procedural' : t.model === 'handcrafted' ? 'Handcrafted' : 'Hybrid'}
                                    </span>
                                </div>

                                <p className="text-xs text-gray-400 mt-3 font-medium leading-relaxed">{t.desc}</p>

                                <div className="mt-4 bg-black/20 border border-white/5 rounded-xl p-3.5 space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                        <span>Procedural Ratio:</span>
                                        <span className="text-white">{Math.round(t.config.proceduralWeight * 100)}%</span>
                                    </div>
                                    {t.model !== 'procedural' && (
                                        <>
                                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                                <span>Weave Pool Probability:</span>
                                                <span className="text-indigo-400">{Math.round(t.config.handcraftedWeaveProbability * 100)}%</span>
                                            </div>
                                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                                <span>Handcrafted Pool Size:</span>
                                                <span className="text-correct font-black">{t.poolCount} questions</span>
                                            </div>
                                            {t.poolCount > 0 && (
                                                <div className="mt-2.5 grid grid-cols-5 gap-1 bg-black/45 border border-white/5 rounded-xl p-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-gray-500">
                                                    {[1, 2, 3, 4, 5].map((lvl) => {
                                                        const lvlCount = t.poolData.levels[lvl] || 0;
                                                        const pct = t.poolCount > 0 ? Math.round((lvlCount / t.poolCount) * 100) : 0;
                                                        return (
                                                            <div key={lvl}>
                                                                <span className={LEVEL_COLORS[lvl]}>L{lvl}</span>
                                                                <span className="block text-white font-black mt-0.5">{lvlCount} ({pct}%)</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h5 className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-2.5">Enabled Templates & Variant Weights</h5>
                                <div className="grid grid-cols-3 gap-2">
                                    {t.config.variantWeights.map((w, idx) => {
                                        if (w === 0) return null;
                                        const pct = weightSum > 0 ? Math.round((w / weightSum) * 100) : 0;
                                        return (
                                            <div key={idx} className="bg-black/35 border border-white/5 rounded-lg p-2 text-center" title={VARIANT_NAMES[idx]}>
                                                <span className="text-[8px] text-gray-500 font-bold uppercase block truncate">{VARIANT_NAMES[idx]}</span>
                                                <span className="text-[10px] font-black text-white mt-0.5 block">{pct}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TopicHub;