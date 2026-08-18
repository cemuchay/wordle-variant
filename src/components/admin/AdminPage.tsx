/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowUpDown,
    Bell,
    BookOpen,
    Check,
    ChevronLeft,
    ChevronRight,
    Copy,
    Edit2,
    EyeOff,
    FileCode,
    Flag,
    Home,
    Image,
    LogOut,
    RefreshCw,
    Search,
    Sparkles,
    Trash2,
    Trophy,
    User,
    X
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getWORDS_3, getWORDS_4, OFFICIAL_WORDS } from '../../data/words';
import { useAdminStatus } from '../../hooks/useAdminStatus';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabaseClient';
import TopicHub from './TopicHub';
import GameStats from './GameStats';
import { BarChart2, Activity } from 'lucide-react';
import { useTopics, useSaveTopicMutation, useToggleTopicActiveMutation, useToggleTopicSuspendedMutation, type WordUpTopic } from '../../hooks/queries/useTopics';
import AnonymizedTelemetrySection from './AnonymizedTelemetrySection';



interface FlaggedWordData {
    id: string;
    word: string;
    word_length: number;
    flagged_by: string;
    reason: string | null;
    created_at: string;
    admin_profile?: {
        username: string;
    };
}

interface HandcraftedQuestion {
    id: string;
    category: string;
    prompt: string;
    choices: string[];
    answer: string;
    explanation: string;
    image_url?: string | null;
    image_urls?: string[] | null;
    no_image_needed?: boolean;
    created_at?: string;
}

const WordUpCurator = ({ triggerToast }: { triggerToast: (text: string, type?: 'success' | 'error') => void }) => {
    const [questions, setQuestions] = useState<HandcraftedQuestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Filters
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'missing' | 'has' | 'excluded' | 'all'>('missing');
    const [searchQuery, setSearchQuery] = useState('');

    // DB-level pre-fetch filters (refs to avoid triggering re-fetches on change)
    const [noImageOnly, setNoImageOnly] = useState(false);
    const [fetchLimit, setFetchLimit] = useState(100);
    const noImageOnlyRef = useRef(noImageOnly);
    const fetchLimitRef = useRef(fetchLimit);

    useEffect(() => {
        noImageOnlyRef.current = noImageOnly;
        fetchLimitRef.current = fetchLimit;
    }, [noImageOnly, fetchLimit]);

    // Selection & Asset editing states
    const [selectedQuestion, setSelectedQuestion] = useState<HandcraftedQuestion | null>(null);
    const [imageUrlVal, setImageUrlVal] = useState('');
    const [imageUrlsList, setImageUrlsList] = useState<string[]>([]);
    const [noImageNeededVal, setNoImageNeededVal] = useState(false);

    // Wiki Search States
    const [wikiSearchTerm, setWikiSearchTerm] = useState('');
    const [wikiLoading, setWikiLoading] = useState(false);
    const [wikiResults, setWikiResults] = useState<{ title: string; url: string }[]>([]);
    const [searchMode, setSearchMode] = useState<'svg' | 'photo'>('svg');
    const [exploreTitle, setExploreTitle] = useState<string | null>(null);

    const fetchQuestions = useCallback(async () => {
        setLoading(true);
        setSelectedQuestion(null);
        setSelectedCategory('all');
        setStatusFilter('all');
        setSearchQuery('');
        try {
            let query = supabase
                .from('wordup_handcrafted_questions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(fetchLimitRef.current);
            if (noImageOnlyRef.current) {
                query = query.is('image_url', null).is('no_image_needed', false);
            }
            const { data, error } = await query;
            if (error) throw error;
            setQuestions(data || []);
        } catch (err: any) {
            triggerToast(err.message || 'Error loading handcrafted questions', 'error');
        } finally {
            setLoading(false);
        }
    }, [triggerToast]);

    useEffect(() => {
        Promise.resolve().then(() => {
            fetchQuestions();
        });
    }, [fetchQuestions]);

    // Maintain a ref to the current search query to prevent constant event listener re-registration
    const wikiSearchTermRef = useRef(wikiSearchTerm);
    useEffect(() => {
        wikiSearchTermRef.current = wikiSearchTerm;
    }, [wikiSearchTerm]);

    // Micro-interaction: Auto-replace search query with selected prompt/answer text after 2 seconds
    useEffect(() => {
        let selectionTimer: any = null;

        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (!selection) return;
            const selectedText = selection.toString().trim();

            if (selectionTimer) {
                clearTimeout(selectionTimer);
                selectionTimer = null;
            }

            if (selectedText.length > 0) {
                selectionTimer = setTimeout(() => {
                    try {
                        const range = selection.getRangeAt(0);
                        const container = document.getElementById('curator-question-details');
                        if (container && range && container.contains(range.commonAncestorContainer)) {
                            const currentSearchTerm = wikiSearchTermRef.current.trim();
                            if (currentSearchTerm.toLowerCase() !== selectedText.toLowerCase()) {
                                setWikiSearchTerm(selectedText);
                                triggerToast(`Updated search query to "${selectedText}"!`);
                            }
                        }
                    } catch {
                        // ignore range errors
                    }
                }, 2000);
            }
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
            if (selectionTimer) clearTimeout(selectionTimer);
        };
    }, [triggerToast]);

    // Auto-extract all unique categories
    const categories = useMemo(() => {
        const set = new Set(questions.map(q => q.category));
        return ['all', ...Array.from(set)];
    }, [questions]);

    // Filter logic
    const filteredQuestions = useMemo(() => {
        return questions.filter(q => {
            // Category filter
            if (selectedCategory !== 'all' && q.category !== selectedCategory) return false;

            // Status filter
            const hasImage = !!q.image_url || (q.image_urls && q.image_urls.length > 0);
            if (statusFilter === 'missing') {
                if (hasImage || q.no_image_needed) return false;
            } else if (statusFilter === 'has') {
                if (!hasImage) return false;
            } else if (statusFilter === 'excluded') {
                if (!q.no_image_needed) return false;
            }

            // Text query filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const promptMatch = q.prompt.toLowerCase().includes(query);
                const answerMatch = q.answer.toLowerCase().includes(query);
                const choicesMatch = q.choices.some(c => c.toLowerCase().includes(query));
                if (!promptMatch && !answerMatch && !choicesMatch) return false;
            }

            return true;
        });
    }, [questions, selectedCategory, statusFilter, searchQuery]);

    // Pre-populate input states on question selection
    useEffect(() => {
        Promise.resolve().then(() => {
            setExploreTitle(null); // Clear active exploration status on question switch

            if (selectedQuestion) {
                setImageUrlVal(selectedQuestion.image_url || '');
                setImageUrlsList(selectedQuestion.image_urls || []);
                setNoImageNeededVal(selectedQuestion.no_image_needed || false);
                setWikiSearchTerm(selectedQuestion.answer);
                setWikiResults([]);

                // Scroll the curator dashboard back to top
                const container = document.querySelector('.h-screen.overflow-y-auto');
                if (container) {
                    container.scrollTo({ top: 0 });
                }
            } else {
                setImageUrlVal('');
                setImageUrlsList([]);
                setNoImageNeededVal(false);
                setWikiSearchTerm('');
                setWikiResults([]);
            }
        });
    }, [selectedQuestion]);

    // Batch resolve SVG URLs in 2 query requests or search Wikipedia page images
    const handleSearchWiki = async (term: string) => {
        if (!term.trim()) return;
        setWikiLoading(true);
        setWikiResults([]);
        setExploreTitle(null); // Reset exploration status on new query
        try {
            if (searchMode === 'svg') {
                const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}%20filetype:svg&srnamespace=6&format=json&origin=*&srlimit=12`;
                const res = await fetch(searchUrl);
                const searchData = await res.json();
                const searchResults = searchData.query?.search || [];

                if (searchResults.length === 0) {
                    triggerToast("No SVG assets found for that query.", "error");
                    return;
                }

                // Batch resolve detailed URLs
                const titles = searchResults.map((r: any) => r.title).join('|');
                const detailsUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
                const detailsRes = await fetch(detailsUrl);
                const detailsData = await detailsRes.json();
                const pages = detailsData.query?.pages || {};

                const mappedResults = searchResults.map((r: any) => {
                    const page = Object.values(pages).find((p: any) => p.title === r.title) as any;
                    const directUrl = page?.imageinfo?.[0]?.url || "";
                    return {
                        title: r.title,
                        url: directUrl
                    };
                }).filter((item: any) => item.url);

                setWikiResults(mappedResults);
            } else {
                const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=0&gsrlimit=12&prop=pageimages&pithumbsize=400&pilimit=12&format=json&origin=*`;
                const res = await fetch(searchUrl);
                const searchData = await res.json();
                const pages = searchData.query?.pages || {};

                const mappedResults = Object.values(pages).map((p: any) => {
                    return {
                        title: p.title,
                        url: p.thumbnail?.source || ""
                    };
                }).filter((item: any) => item.url)
                    .sort((a, b) => a.title.localeCompare(b.title));

                if (mappedResults.length === 0) {
                    triggerToast("No photographic assets found on Wikipedia for that query.", "error");
                    return;
                }

                setWikiResults(mappedResults);
            }
        } catch (err: any) {
            triggerToast(err.message || 'Failed to query Wiki API', 'error');
        } finally {
            setWikiLoading(false);
        }
    };

    // Retrieve all images embedded within a specific Wikipedia article
    const handleExploreArticle = async (articleTitle: string) => {
        if (!articleTitle) return;
        setWikiLoading(true);
        setExploreTitle(articleTitle);
        setWikiResults([]);
        try {
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(articleTitle)}&generator=images&gimlimit=35&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`;
            const res = await fetch(searchUrl);
            const searchData = await res.json();
            const pages = searchData.query?.pages || {};

            const blacklist = ['icon', 'logo', 'lock', 'padlock', 'edit', 'stub', 'sound', 'speaker', 'increase', 'decrease', 'play', 'arrow', 'magnifying', 'red_penc', 'wiki', 'commons', 'disg', 'signature'];
            const cleanResults = Object.values(pages).map((p: any) => {
                const info = p.imageinfo?.[0];
                return {
                    title: p.title || "",
                    url: info?.thumburl || info?.url || ""
                };
            }).filter((item: any) => {
                if (!item.url) return false;
                const name = item.title.toLowerCase();
                // Exclude system icons and non-image formats
                if (blacklist.some(term => name.includes(term))) return false;
                return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp') || name.endsWith('.svg');
            }).sort((a: any, b: any) => a.title.localeCompare(b.title));

            if (cleanResults.length === 0) {
                triggerToast("No image assets found inside this article.", "error");
                setExploreTitle(null);
                return;
            }

            setWikiResults(cleanResults);
        } catch (err: any) {
            triggerToast(err.message || 'Failed to query Wikipedia article images', 'error');
            setExploreTitle(null);
        } finally {
            setWikiLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedQuestion) return;
        setSaving(true);
        try {
            const updates = {
                image_url: imageUrlVal.trim() || null,
                image_urls: imageUrlsList.length > 0 ? imageUrlsList : null,
                no_image_needed: noImageNeededVal
            };

            const { error } = await supabase
                .from('wordup_handcrafted_questions')
                .update(updates)
                .eq('id', selectedQuestion.id);

            if (error) throw error;

            triggerToast('Asset mapped successfully!');

            // Pre-calculate the next question to edit in the current list before we trigger setQuestions state update
            const currentIndex = filteredQuestions.findIndex(q => q.id === selectedQuestion.id);
            const nextQuestion = (currentIndex !== -1 && currentIndex + 1 < filteredQuestions.length)
                ? filteredQuestions[currentIndex + 1]
                : null;

            // Update local lists
            setQuestions(prev => prev.map(q => q.id === selectedQuestion.id ? { ...q, ...updates } : q));
            setSelectedQuestion(nextQuestion);
        } catch (err: any) {
            triggerToast(err.message || 'Error updating question assets', 'error');
        } finally {
            setSaving(false);
        }
    };

    const formatCategory = (cat: string) => {
        if (cat === 'all') return 'All Categories';
        return cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Panel: Question list & filters */}
            <div className="lg:col-span-4 bg-gray-900 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 max-h-[750px]">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-tight text-white flex items-center gap-2">
                        <Image className="text-correct" size={16} /> Handcrafted List ({filteredQuestions.length})
                    </h3>
                    <button
                        onClick={fetchQuestions}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Refresh list"
                        disabled={loading}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Search & Topic Filters */}
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                        <input
                            type="text"
                            placeholder="Search prompt or choices..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none focus:border-correct/50 transition-all text-white placeholder-gray-600"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-xl p-2 text-xs focus:outline-none focus:border-correct/50 text-white"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat} className="bg-gray-900 text-white">
                                    {formatCategory(cat)}
                                </option>
                            ))}
                        </select>

                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as any)}
                            className="bg-black/40 border border-white/10 rounded-xl p-2 text-xs focus:outline-none focus:border-correct/50 text-white"
                        >
                            <option value="missing" className="bg-gray-900 text-white">Missing Image</option>
                            <option value="has" className="bg-gray-900 text-white">Has Image</option>
                            <option value="excluded" className="bg-gray-900 text-white">Excluded (Skip)</option>
                            <option value="all" className="bg-gray-900 text-white">All Questions</option>
                        </select>
                    </div>

                    {/* DB-level pre-fetch filters */}
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={noImageOnly}
                                onChange={e => setNoImageOnly(e.target.checked)}
                                className="accent-correct w-3.5 h-3.5"
                            />
                            No images
                        </label>

                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <span>Limit:</span>
                            <input
                                type="number"
                                min={10}
                                max={500}
                                step={10}
                                value={fetchLimit}
                                onChange={e => setFetchLimit(Number(e.target.value) || 100)}
                                className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-correct/50 text-center"
                            />
                        </div>
                    </div>
                </div>

                {/* Scrollable Questions list */}
                <div className="overflow-y-auto pr-1 space-y-2 flex-1 scrollbar-thin scrollbar-thumb-white/10">
                    {loading ? (
                        <div className="py-8 text-center text-xs font-bold text-gray-600 uppercase tracking-widest flex items-center justify-center gap-2">
                            <RefreshCw size={14} className="animate-spin text-correct" />
                            Loading database...
                        </div>
                    ) : filteredQuestions.length === 0 ? (
                        <div className="py-12 border border-dashed border-white/5 rounded-xl text-center text-xs font-bold text-gray-600 uppercase tracking-widest">
                            No matching questions
                        </div>
                    ) : (
                        filteredQuestions.map(q => {
                            const hasImage = !!q.image_url || (q.image_urls && q.image_urls.length > 0);
                            const isSelected = selectedQuestion?.id === q.id;

                            return (
                                <button
                                    key={q.id}
                                    onClick={() => setSelectedQuestion(q)}
                                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${isSelected
                                        ? 'bg-correct border-correct text-black shadow-lg shadow-correct/10'
                                        : 'bg-black/40 border-white/5 text-gray-300 hover:border-white/20 hover:bg-white/5'
                                        }`}
                                >
                                    <div className="mt-1">
                                        {q.no_image_needed ? (
                                            <span title="Excluded"><EyeOff size={14} className={isSelected ? 'text-black' : 'text-gray-600'} /></span>
                                        ) : hasImage ? (
                                            <div className={`w-3.5 h-3.5 rounded-full border ${isSelected ? 'bg-black border-black' : 'bg-correct/20 border-correct text-correct'}`} />
                                        ) : (
                                            <div className="w-3.5 h-3.5 rounded-full border border-white/25 bg-black/20" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 justify-between">
                                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${isSelected ? 'bg-black/10 text-black' : 'bg-white/5 text-gray-400'
                                                }`}>
                                                {q.category}
                                            </span>
                                        </div>
                                        <p className={`text-xs font-bold mt-1.5 leading-snug line-clamp-2 ${isSelected ? 'text-black' : 'text-white'
                                            }`}>
                                            {q.prompt}
                                        </p>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Panel: curator & Wiki search workspace */}
            <div className="lg:col-span-8 space-y-6">
                {!selectedQuestion ? (
                    <div className="bg-gray-900/60 border border-white/15 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[450px]">
                        <div className="p-4 rounded-full bg-white/5 text-gray-500 mb-4 border border-white/10">
                            <Image size={36} />
                        </div>
                        <h4 className="text-base font-black uppercase tracking-tighter text-gray-400">Curator Workspace</h4>
                        <p className="text-xs text-gray-500 max-w-xs mt-2 font-bold uppercase tracking-wider">
                            Select a question from the left sidebar panel to start mapping SVG assets.
                        </p>
                    </div>
                ) : (
                    <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-6">
                        {/* Selected Question Header Info */}
                        <div id="curator-question-details" className="border-b border-white/5 pb-5">
                            <div className="flex items-center gap-2 justify-between flex-wrap">
                                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                    Category: {selectedQuestion.category}
                                </span>

                                <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-400 hover:text-white cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={noImageNeededVal}
                                        onChange={e => setNoImageNeededVal(e.target.checked)}
                                        className="accent-correct"
                                    />
                                    <EyeOff size={14} /> Exclude (No Image Needed)
                                </label>
                            </div>

                            <h4 className="text-lg font-black tracking-tight mt-4 text-white">
                                {selectedQuestion.prompt}
                            </h4>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                                {selectedQuestion.choices.map((choice, i) => {
                                    const isCorrect = choice === selectedQuestion.answer;
                                    return (
                                        <div
                                            key={i}
                                            className={`p-3 rounded-xl border text-xs font-bold ${isCorrect
                                                ? 'bg-correct/10 border-correct text-correct'
                                                : 'bg-black/30 border-white/5 text-gray-400'
                                                }`}
                                        >
                                            <span className="text-[10px] opacity-40 uppercase block mb-1">Choice {i + 1}</span>
                                            {choice}
                                        </div>
                                    );
                                })}
                            </div>

                            <p className="text-xs text-gray-500 mt-4 font-bold uppercase leading-relaxed">
                                <span className="text-white">Explanation:</span> {selectedQuestion.explanation}
                            </p>
                        </div>

                        {/* Direct URL Form Details */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                                        Primary SVG Image URL (`image_url`)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="wikimedia:File:... or direct https URL"
                                            value={imageUrlVal}
                                            onChange={e => setImageUrlVal(e.target.value)}
                                            className="flex-1 bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-correct/50 text-white"
                                        />
                                        {imageUrlVal && (
                                            <button
                                                onClick={() => setImageUrlVal('')}
                                                className="px-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-black uppercase hover:bg-red-500/20 transition-all cursor-pointer"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                                        Additional URLs List (`image_urls`)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Add list element url..."
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                    const val = e.currentTarget.value.trim();
                                                    if (!imageUrlsList.includes(val)) {
                                                        setImageUrlsList(prev => [...prev, val]);
                                                    }
                                                    e.currentTarget.value = '';
                                                }
                                            }}
                                            className="flex-1 bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-correct/50 text-white"
                                        />
                                        {imageUrlsList.length > 0 && (
                                            <button
                                                onClick={() => setImageUrlsList([])}
                                                className="px-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-black uppercase hover:bg-red-500/20 transition-all cursor-pointer"
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {imageUrlsList.map((url, index) => (
                                            <span key={index} className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg pl-2.5 pr-1.5 py-1 text-[10px] font-bold text-gray-300">
                                                <span className="truncate max-w-[150px]">{url}</span>
                                                <button
                                                    onClick={() => setImageUrlsList(prev => prev.filter((_, idx) => idx !== index))}
                                                    className="text-gray-500 hover:text-white rounded-full p-0.5 cursor-pointer"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Active Preview if Image set */}
                            {imageUrlVal && (
                                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
                                    <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Live SVG Preview</span>
                                    <div className="w-32 h-32 flex items-center justify-center border border-white/10 rounded-xl bg-white/5 p-2 overflow-hidden">
                                        <img
                                            src={imageUrlVal.startsWith('wikimedia:') ? `https://commons.wikimedia.org/wiki/Special:FilePath/${imageUrlVal.replace(/^wikimedia:File:/, '')}` : imageUrlVal}
                                            alt="SVG Preview"
                                            className="max-w-full max-h-full object-contain"
                                            onError={(e) => {
                                                // fallback check
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <span className="text-[9px] text-gray-400 font-mono break-all">{imageUrlVal}</span>
                                </div>
                            )}
                        </div>

                        {/* Wikimedia Commons SVG Search Engine panel */}
                        <div className="bg-black/20 border border-white/5 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div>
                                    <h5 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                                        <Sparkles size={14} className="text-yellow-400" /> Search Wiki Assets
                                    </h5>
                                    <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">Find vector artwork or photographic portraits</p>
                                </div>

                                {/* Hybrid Search Toggle Pills */}
                                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 self-start">
                                    <button
                                        onClick={() => {
                                            setSearchMode('svg');
                                            setWikiResults([]);
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${searchMode === 'svg'
                                            ? 'bg-correct text-black'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        Vector / SVG
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSearchMode('photo');
                                            setWikiResults([]);
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${searchMode === 'photo'
                                            ? 'bg-correct text-black'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        Photo / Portrait
                                    </button>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleSearchWiki(selectedQuestion.answer)}
                                        className="text-[9px] font-black uppercase tracking-wider text-correct bg-correct/10 hover:bg-correct/20 border border-correct/20 px-2 py-1 rounded"
                                    >
                                        Use Answer
                                    </button>
                                    <button
                                        onClick={() => {
                                            const words = selectedQuestion.prompt.split(' ').filter(w => w.length > 4 && /^[a-zA-Z]+$/.test(w));
                                            if (words.length > 0) {
                                                handleSearchWiki(words[Math.floor(Math.random() * words.length)]);
                                            }
                                        }}
                                        className="text-[9px] font-black uppercase tracking-wider text-gray-400 bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-1 rounded"
                                    >
                                        Random Word
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter entity query e.g. Lionel Messi, Oxygen, France flag..."
                                    value={wikiSearchTerm}
                                    onChange={e => setWikiSearchTerm(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearchWiki(wikiSearchTerm)}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-correct/50 text-white"
                                />
                                <button
                                    onClick={() => handleSearchWiki(wikiSearchTerm)}
                                    disabled={wikiLoading}
                                    className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-black uppercase text-[10px] tracking-widest px-6 py-2.5 rounded-xl transition-all shadow-lg cursor-pointer flex items-center gap-1.5"
                                >
                                    {wikiLoading ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                                    Search
                                </button>
                            </div>

                            {/* Exploring Article Header Banner */}
                            {exploreTitle && (
                                <div className="flex items-center justify-between bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs">
                                    <span className="font-bold text-gray-300">
                                        Exploring images in: <strong className="text-correct">{exploreTitle}</strong>
                                    </span>
                                    <button
                                        onClick={() => {
                                            setExploreTitle(null);
                                            handleSearchWiki(wikiSearchTerm);
                                        }}
                                        className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded bg-indigo-500/5 cursor-pointer"
                                    >
                                        ← Back to Search
                                    </button>
                                </div>
                            )}

                            {/* Results Grid */}
                            {wikiLoading ? (
                                <div className="py-8 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest animate-pulse">
                                    Searching Wikimedia databases...
                                </div>
                            ) : wikiResults.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-1">
                                    {wikiResults.map((item, index) => (
                                        <div
                                            key={index}
                                            className="group relative bg-black/40 border border-white/5 hover:border-correct/40 rounded-xl p-3.5 flex flex-col items-center gap-2.5 transition-all text-center"
                                        >
                                            {/* Candidate Preview */}
                                            <div className="w-16 h-16 flex items-center justify-center bg-white/5 p-1 rounded-lg overflow-hidden border border-white/5">
                                                <img
                                                    src={item.url}
                                                    alt="Candidate SVG"
                                                    className="max-w-full max-h-full object-contain"
                                                    loading="lazy"
                                                />
                                            </div>

                                            <p className="text-[9px] font-bold text-gray-400 truncate w-full" title={item.title}>
                                                {item.title.replace(/^File:/, '')}
                                            </p>

                                            {/* Mapping Controls Hover Overlay */}
                                            <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex flex-col items-center justify-center gap-1.5 p-2">
                                                <button
                                                    onClick={() => {
                                                        const val = searchMode === 'svg' ? `wikimedia:${item.title}` : item.url;
                                                        setImageUrlVal(val);
                                                        triggerToast("Set as primary image!");
                                                    }}
                                                    className="w-full bg-correct text-black font-black uppercase text-[8px] py-1.5 rounded hover:scale-105 transition-transform cursor-pointer"
                                                >
                                                    Use Primary
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const val = searchMode === 'svg' ? `wikimedia:${item.title}` : item.url;
                                                        if (!imageUrlsList.includes(val)) {
                                                            setImageUrlsList(prev => [...prev, val]);
                                                            triggerToast("Added to list!");
                                                        }
                                                    }}
                                                    className="w-full bg-white/10 hover:bg-white/20 text-white font-black uppercase text-[8px] py-1.5 rounded hover:scale-105 transition-transform border border-white/10 cursor-pointer"
                                                >
                                                    Add to List
                                                </button>
                                                {searchMode === 'photo' && !exploreTitle && (
                                                    <button
                                                        onClick={() => handleExploreArticle(item.title)}
                                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[8px] py-1.5 rounded hover:scale-105 transition-transform cursor-pointer"
                                                    >
                                                        Explore Images
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 border border-dashed border-white/5 rounded-xl text-center text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                    Search results will display here
                                </div>
                            )}
                        </div>

                        {/* Curator save operations bar */}
                        <div className="flex justify-between items-center border-t border-white/5 pt-5 gap-4">
                            <button
                                onClick={() => setSelectedQuestion(null)}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest px-6 py-3.5 rounded-xl transition-all cursor-pointer"
                            >
                                Close Editor
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-correct hover:brightness-110 disabled:opacity-50 text-black font-black uppercase text-[10px] tracking-widest px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-correct/20 cursor-pointer flex items-center gap-1.5"
                            >
                                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                Save Question Assets
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const BotMarathonManagement = ({ triggerToast }: { triggerToast: (text: string, type?: 'success' | 'error') => void }) => {
    const [loading, setLoading] = useState(false);
    const [marathons, setMarathons] = useState<any[]>([]);

    const fetchMarathons = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('challenges')
                .select('*, profiles!creator_id(username)')
                .eq('is_bot_marathon', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMarathons(data || []);
        } catch (err: any) {
            triggerToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [triggerToast]);

    useEffect(() => {
        Promise.resolve().then(() => {
            fetchMarathons();
        });
    }, [fetchMarathons]);

    const createNextWeekMarathon = async () => {
        const confirmed = window.confirm("This will create a new Bot Marathon challenge for Variant Bot. Continue?");
        if (!confirmed) return;

        setLoading(true);
        try {
            // Determine next Monday
            const now = new Date();
            const lagosOffset = 1 * 60 * 60 * 1000; // Lagos is UTC+1
            const lagosNow = new Date(now.getTime() + lagosOffset);

            const daysUntilMonday = (8 - lagosNow.getUTCDay()) % 7 || 7;
            const nextMonday = new Date(lagosNow.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
            nextMonday.setUTCHours(0, 0, 0, 0);

            const nextSunday = new Date(nextMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
            nextSunday.setUTCHours(23, 59, 59, 999);

            // Create the challenge
            const { error: challengeError } = await supabase
                .from('challenges')
                .insert({
                    creator_id: '00000000-0000-0000-0000-000000000b0b',
                    mode: 'ANYTIME', // Marathon uses ANYTIME mode logic for sequences
                    word_length: 5, // Default/dummy as marathon uses dynamic
                    target_word: 'MARATHON', // Dummy
                    expires_at: nextSunday.toISOString(),
                    is_bot_marathon: true
                });

            if (challengeError) throw challengeError;

            // Pre-generate words for the entire week (Monday to Sunday)
            const allGeneratedWords = [];

            for (let d = 0; d < 7; d++) {
                const currentDay = new Date(nextMonday.getTime() + d * 24 * 60 * 60 * 1000);
                const playDateStr = currentDay.toISOString().split('T')[0];

                for (let len = 3; len <= 7; len++) {
                    const pool = await OFFICIAL_WORDS[len]();
                    const word = pool[Math.floor(Math.random() * pool.length)];
                    const salt = Math.random().toString(36).substring(2, 15);

                    allGeneratedWords.push({
                        play_date: playDateStr,
                        word_length: len,
                        target_word: word,
                        salt: salt
                    });
                }
            }

            const { error: wordsError } = await supabase
                .from('bot_marathon_daily_words')
                .upsert(allGeneratedWords);

            if (wordsError) throw wordsError;

            triggerToast("Next week's Bot Marathon and all daily words created successfully!");
            fetchMarathons();
        } catch (err: any) {
            triggerToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                            <Trophy className="text-indigo-400" /> Bot Marathon Management
                        </h3>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">
                            Control and monitor system-managed weekly events
                        </p>
                    </div>
                    <button
                        onClick={createNextWeekMarathon}
                        disabled={loading}
                        className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-black uppercase text-[10px] tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-pointer"
                    >
                        {loading ? <RefreshCw size={14} className="animate-spin" /> : <Trophy size={14} />}
                        Create Next Week's Event
                    </button>
                </div>

                <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Event History</h4>
                    {marathons.length === 0 ? (
                        <div className="bg-black/40 border border-white/5 rounded-xl p-8 text-center">
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">No bot marathons found</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        <th className="py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Created</th>
                                        <th className="py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Expires</th>
                                        <th className="py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {marathons.map((m) => (
                                        <tr key={m.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="py-4 px-4 text-xs font-mono text-gray-300">
                                                {new Date(m.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-4 px-4 text-xs font-mono text-gray-300">
                                                {new Date(m.expires_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-4 px-4">
                                                {new Date(m.expires_at) > new Date() ? (
                                                    <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest">Active</span>
                                                ) : (
                                                    <span className="bg-gray-500/10 text-gray-500 border border-gray-500/20 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest">Expired</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};



interface BroadcastResult {
    total_recipients?: number;
    push_users?: number;
    email_sent?: number;
}

const ADMIN_BROADCAST_DRAFT_KEY = "variant_admin_broadcast_draft";

const AdminCustomNotificationBroadcaster = ({ triggerToast }: { triggerToast: (text: string, type?: 'success' | 'error') => void }) => {
    const [title, setTitle] = useState(() => {
        try {
            const saved = localStorage.getItem(ADMIN_BROADCAST_DRAFT_KEY);
            return saved ? JSON.parse(saved).title || '' : '';
        } catch { return ''; }
    });
    const [message, setMessage] = useState(() => {
        try {
            const saved = localStorage.getItem(ADMIN_BROADCAST_DRAFT_KEY);
            return saved ? JSON.parse(saved).message || '' : '';
        } catch { return ''; }
    });
    const [url, setUrl] = useState(() => {
        try {
            const saved = localStorage.getItem(ADMIN_BROADCAST_DRAFT_KEY);
            return saved ? JSON.parse(saved).url || '/' : '/';
        } catch { return '/'; }
    });
    const [deliveryMode, setDeliveryMode] = useState<'hybrid' | 'push_only' | 'email_only' | 'in_app_only'>(() => {
        try {
            const saved = localStorage.getItem(ADMIN_BROADCAST_DRAFT_KEY);
            return saved ? JSON.parse(saved).deliveryMode || 'hybrid' : 'hybrid';
        } catch { return 'hybrid'; }
    });
    const [targetAudience, setTargetAudience] = useState<'active' | 'all' | 'participants' | 'user'>(() => {
        try {
            const saved = localStorage.getItem(ADMIN_BROADCAST_DRAFT_KEY);
            return saved ? JSON.parse(saved).targetAudience || 'active' : 'active';
        } catch { return 'active'; }
    });
    const [targetUserId, setTargetUserId] = useState(() => {
        try {
            const saved = localStorage.getItem(ADMIN_BROADCAST_DRAFT_KEY);
            return saved ? JSON.parse(saved).targetUserId || '' : '';
        } catch { return ''; }
    });
    const [draftSaved, setDraftSaved] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState<BroadcastResult | null>(null);

    // Debounced LocalStorage Draft Save Effect (500ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            try {
                if (title.trim() || message.trim()) {
                    const draft = { title, message, url, deliveryMode, targetAudience, targetUserId };
                    localStorage.setItem(ADMIN_BROADCAST_DRAFT_KEY, JSON.stringify(draft));
                    setDraftSaved(true);
                } else {
                    localStorage.removeItem(ADMIN_BROADCAST_DRAFT_KEY);
                    setDraftSaved(false);
                }
            } catch (e) {
                console.warn("Failed to save broadcast draft", e);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [title, message, url, deliveryMode, targetAudience, targetUserId]);

    const clearDraft = () => {
        setTitle('');
        setMessage('');
        setUrl('/');
        setDeliveryMode('hybrid');
        setTargetAudience('active');
        setTargetUserId('');
        setDraftSaved(false);
        try { localStorage.removeItem(ADMIN_BROADCAST_DRAFT_KEY); } catch {}
        triggerToast('Draft cleared!');
    };

    const handleSendBroadcast = async () => {
        if (!title.trim() || !message.trim()) {
            triggerToast('Please provide both Title and Message.', 'error');
            return;
        }

        if (targetAudience === 'user' && !targetUserId.trim()) {
            triggerToast('Please provide a Target User ID.', 'error');
            return;
        }

        setSending(true);
        setSendResult(null);

        try {
            const { data, error } = await supabase.rpc('send_admin_custom_notification', {
                p_title: title.trim(),
                p_message: message.trim(),
                p_url: url.trim() || '/',
                p_delivery_mode: deliveryMode,
                p_target_audience: targetAudience,
                p_target_user_id: targetAudience === 'user' ? targetUserId.trim() : null
            });

            if (error) throw error;

            setSendResult(data);
            triggerToast(`Broadcast sent successfully to ${data?.total_recipients || 0} user(s)!`);
            
            // Clear draft on successful broadcast
            setTitle('');
            setMessage('');
            setDraftSaved(false);
            try { localStorage.removeItem(ADMIN_BROADCAST_DRAFT_KEY); } catch {}
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to dispatch custom notification broadcast.';
            triggerToast(msg, 'error');
        } finally {
            setSending(false);
        }
    };



    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Form Controls */}
            <div className="lg:col-span-7 bg-gray-900 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
                            <Bell size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                                Broadcast Custom Notification
                                {draftSaved && (
                                    <span className="px-2 py-0.5 bg-correct/10 border border-correct/30 text-correct text-[9px] font-black uppercase rounded-md tracking-wider">
                                        Draft Auto-Saved
                                    </span>
                                )}
                            </h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Dispatch customized alerts via push, email, & in-app</p>
                        </div>
                    </div>
                    {draftSaved && (
                        <button
                            onClick={clearDraft}
                            className="px-3 py-1.5 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                        >
                            Clear Draft
                        </button>
                    )}
                </div>


                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Notification Title</label>
                        <input
                            type="text"
                            placeholder="e.g. 🎉 Weekend Championship Tournament!"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 px-4 text-xs focus:outline-none focus:border-correct/50 text-white placeholder-gray-600 font-semibold"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Message Content</label>
                        <textarea
                            rows={4}
                            placeholder="Type the message body to deliver to players..."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs focus:outline-none focus:border-correct/50 text-white placeholder-gray-600 font-medium resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Target Action URL</label>
                            <input
                                type="text"
                                placeholder="e.g. / or /?challenge=123 or /?open=leaderboard"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-xs focus:outline-none focus:border-correct/50 text-white font-mono"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Delivery Mode</label>
                            <select
                                value={deliveryMode}
                                onChange={e => setDeliveryMode(e.target.value as any)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-xs focus:outline-none focus:border-correct/50 text-white font-semibold"
                            >
                                <option value="hybrid" className="bg-gray-900">Hybrid (Smart Push / Email + In-App)</option>
                                <option value="push_only" className="bg-gray-900">Push & In-App Only</option>
                                <option value="email_only" className="bg-gray-900">Email & In-App Only</option>
                                <option value="in_app_only" className="bg-gray-900">In-App Notification Only</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Target Audience Segment</label>
                            <select
                                value={targetAudience}
                                onChange={e => setTargetAudience(e.target.value as any)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-xs focus:outline-none focus:border-correct/50 text-white font-semibold"
                            >
                                <option value="active" className="bg-gray-900">Active Users (Logged in last 14 days)</option>
                                <option value="all" className="bg-gray-900">All Registered Users</option>
                                <option value="participants" className="bg-gray-900">Bot Marathon Participants</option>
                                <option value="user" className="bg-gray-900">Specific User ID</option>
                            </select>
                        </div>

                        {targetAudience === 'user' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Target User UUID</label>
                                <input
                                    type="text"
                                    placeholder="Enter target user ID"
                                    value={targetUserId}
                                    onChange={e => setTargetUserId(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-xs focus:outline-none focus:border-correct/50 text-white font-mono"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <button
                        onClick={handleSendBroadcast}
                        disabled={sending || !title.trim() || !message.trim()}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-widest py-4 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {sending ? <RefreshCw size={16} className="animate-spin" /> : <Bell size={16} />}
                        {sending ? 'Broadcasting Notification...' : 'Dispatch Broadcast'}
                    </button>
                </div>

                {sendResult && (
                    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 space-y-2">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider block">Last Broadcast Stats</span>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-black/30 p-2 rounded-xl">
                                <span className="text-lg font-black text-white">{sendResult.total_recipients || 0}</span>
                                <span className="text-[9px] text-gray-400 block uppercase">Recipients</span>
                            </div>
                            <div className="bg-black/30 p-2 rounded-xl">
                                <span className="text-lg font-black text-indigo-400">{sendResult.push_users || 0}</span>
                                <span className="text-[9px] text-gray-400 block uppercase">Push Ready</span>
                            </div>
                            <div className="bg-black/30 p-2 rounded-xl">
                                <span className="text-lg font-black text-correct">{sendResult.email_sent || 0}</span>
                                <span className="text-[9px] text-gray-400 block uppercase">Email Queued</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Live Preview Panel */}
            <div className="lg:col-span-5 space-y-6">
                <div className="bg-gray-900 border border-white/10 rounded-3xl p-6 space-y-6">
                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                        <Sparkles size={14} className="text-yellow-400" /> Live Delivery Preview
                    </h4>

                    {/* Preview 1: In-App Toast */}
                    <div className="space-y-2">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">1. In-App Alert Preview</span>
                        <div className="bg-gray-900 border border-correct/30 rounded-2xl p-4 shadow-xl flex items-start gap-3">
                            <div className="bg-correct/20 p-2 rounded-xl text-correct shrink-0">
                                <Bell size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h5 className="text-xs font-black uppercase tracking-tight text-white truncate">
                                    {title || 'Sample Broadcast Title'}
                                </h5>
                                <p className="text-[11px] text-gray-400 line-clamp-2 leading-tight mt-1">
                                    {message || 'Sample notification content body will be displayed here for the recipient.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Preview 2: Browser Push */}
                    <div className="space-y-2">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">2. Web Push Notification Banner</span>
                        <div className="bg-black/80 border border-white/15 rounded-2xl p-4 shadow-xl flex items-start gap-3 font-sans">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                V
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between text-[9px] text-gray-400">
                                    <span className="font-bold text-white uppercase">variant</span>
                                    <span>Just now</span>
                                </div>
                                <h5 className="text-xs font-bold text-white mt-0.5 truncate">{title || 'Sample Title'}</h5>
                                <p className="text-[10px] text-gray-300 line-clamp-2 leading-tight mt-0.5">{message || 'Sample notification message body...'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Preview 3: Dark Mode Email */}
                    <div className="space-y-2">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">3. Dark Mode Email Template</span>
                        <div className="bg-[#030712] border border-[#1f2937] rounded-2xl p-5 text-gray-200 font-sans space-y-3">
                            <div className="w-full h-1 bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-full" />
                            <h5 className="text-sm font-black text-white uppercase">{title || 'Sample Title'}</h5>
                            <p className="text-xs text-gray-400 leading-relaxed">{message || 'Sample email message body text.'}</p>
                            <div className="pt-2 text-center">
                                <span className="inline-block bg-gradient-to-r from-indigo-500 to-indigo-700 text-white text-[10px] font-extrabold uppercase tracking-wider px-4 py-2 rounded-xl">
                                    Open Variant
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AdminPage: React.FC = () => {
    const [WORDS_3, setWORDS_3] = useState<string[]>([]);
    const [WORDS_4, setWORDS_4] = useState<string[]>([]);

    useEffect(() => { getWORDS_3().then(setWORDS_3); }, []);
    useEffect(() => { getWORDS_4().then(setWORDS_4); }, []);

    const { user, loading: authLoading, signInWithEmail, signOut } = useAuth();
    const { isAdmin, loading: adminLoading } = useAdminStatus(user?.id);

    // Navigation state
    const [activeTab, setActiveTab] = useState<'words' | 'marathon' | 'wordup' | 'topics' | 'dynamic_topics' | 'stats' | 'telemetry' | 'broadcast'>('words');



    // Authentication States
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);

    // Words States
    const [activeLength, setActiveLength] = useState<number>(3);
    const [filterType, setFilterType] = useState<'all' | 'flagged' | 'unflagged'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [startLetter, setStartLetter] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'alpha-asc' | 'alpha-desc' | 'flagged-first' | 'unflagged-first'>('alpha-asc');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // Database Status
    const [flaggedMap, setFlaggedMap] = useState<Map<string, FlaggedWordData>>(new Map());
    const [loadingFlags, setLoadingFlags] = useState(false);
    const [pushSubCount, setPushSubCount] = useState<number | null>(null);

    // Modal States
    const [activeModal, setActiveModal] = useState<'flag' | 'edit' | null>(null);
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [reviewReason, setReviewReason] = useState('');
    const [modalLoading, setModalLoading] = useState(false);

    const [sqlCopied, setSqlCopied] = useState(false);
    const [showSqlHelper, setShowSqlHelper] = useState(false);

    // Fetch Flagged Status from DB
    const fetchFlaggedWords = useCallback(async () => {
        setLoadingFlags(true);
        try {
            const { data, error } = await supabase
                .from('flagged_words')
                .select('*, admin_profile:profiles(username)')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching flagged words:', error);
            } else {
                const map = new Map<string, FlaggedWordData>();
                data?.forEach((row: any) => {
                    map.set(row.word.toUpperCase(), row);
                });
                setFlaggedMap(map);
            }

            // Also fetch push sub count
            const { count, error: countError } = await supabase
                .from('push_subscriptions')
                .select('*', { count: 'exact', head: true });

            if (!countError) setPushSubCount(count);
        } finally {
            setLoadingFlags(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) {
            Promise.resolve().then(() => {
                fetchFlaggedWords();
            });
        }
    }, [isAdmin, fetchFlaggedWords]);

    // Toast Utility (Local simple version)
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const triggerToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
        setToast({ text, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // Filter words logic
    const wordsSource = useMemo(() => activeLength === 3 ? WORDS_3 : WORDS_4, [activeLength, WORDS_3, WORDS_4]);

    const processedWords = useMemo(() => {
        let results = [...wordsSource];

        // Search Filter
        if (searchQuery) {
            const query = searchQuery.toUpperCase();
            results = results.filter(w => w.includes(query));
        }

        // Letter Filter
        if (startLetter) {
            results = results.filter(w => w.startsWith(startLetter));
        }

        // Status Filter
        if (filterType === 'flagged') {
            results = results.filter(w => flaggedMap.has(w));
        } else if (filterType === 'unflagged') {
            results = results.filter(w => !flaggedMap.has(w));
        }

        // Sorting
        results.sort((a, b) => {
            if (sortBy === 'alpha-asc') return a.localeCompare(b);
            if (sortBy === 'alpha-desc') return b.localeCompare(a);
            if (sortBy === 'flagged-first') {
                const aFlagged = flaggedMap.has(a);
                const bFlagged = flaggedMap.has(b);
                if (aFlagged === bFlagged) return a.localeCompare(b);
                return aFlagged ? -1 : 1;
            }
            if (sortBy === 'unflagged-first') {
                const aFlagged = flaggedMap.has(a);
                const bFlagged = flaggedMap.has(b);
                if (aFlagged === bFlagged) return a.localeCompare(b);
                return aFlagged ? 1 : -1;
            }
            return 0;
        });

        return results;
    }, [wordsSource, searchQuery, startLetter, filterType, flaggedMap, sortBy]);

    // Reset pagination when filter/search/length changes
    useEffect(() => {
        Promise.resolve().then(() => {
            setCurrentPage(1);
        });
    }, [activeLength, filterType, searchQuery, startLetter, sortBy]);

    const totalPages = Math.ceil(processedWords.length / itemsPerPage);
    const paginatedWords = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return processedWords.slice(startIndex, startIndex + itemsPerPage);
    }, [processedWords, currentPage]);

    // HANDLERS
    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError(null);
        try {
            const { error } = await signInWithEmail(loginEmail, loginPassword);
            if (error) setLoginError(error.message);
        } catch (err: any) {
            setLoginError(err.message || 'Login failed');
        } finally {
            setLoginLoading(false);
        }
    };

    // Flagging handler
    const submitFlag = async () => {
        if (!selectedWord) return;
        setModalLoading(true);
        try {
            const { error } = await supabase
                .from('flagged_words')
                .insert({
                    word: selectedWord.toUpperCase(),
                    word_length: activeLength,
                    flagged_by: user!.id,
                    reason: reviewReason.trim() || null
                });

            if (error) {
                triggerToast(error.message, 'error');
            } else {
                triggerToast(`"${selectedWord}" flagged for review.`);
                setActiveModal(null);
                setReviewReason('');
                setSelectedWord(null);
                await fetchFlaggedWords();
            }
        } catch (err: any) {
            triggerToast(err.message || 'Error flagging word.', 'error');
        } finally {
            setModalLoading(false);
        }
    };

    // Unflag review handler
    const deleteFlag = async (word: string) => {
        try {
            const { error } = await supabase
                .from('flagged_words')
                .delete()
                .eq('word', word.toUpperCase());

            if (error) {
                triggerToast(error.message, 'error');
            } else {
                triggerToast(`Flag removed for "${word}".`);
                await fetchFlaggedWords();
            }
        } catch (err: any) {
            triggerToast(err.message || 'Error deleting flag.', 'error');
        }
    };

    // Update Flag Reason Notes
    const submitEditReason = async () => {
        if (!selectedWord) return;
        setModalLoading(true);
        try {
            const { error } = await supabase
                .from('flagged_words')
                .update({ reason: reviewReason.trim() || null })
                .eq('word', selectedWord.toUpperCase());

            if (error) {
                triggerToast(error.message, 'error');
            } else {
                triggerToast(`Updated flag details for "${selectedWord}".`);
                setActiveModal(null);
                setReviewReason('');
                setSelectedWord(null);
                await fetchFlaggedWords();
            }
        } catch (err: any) {
            triggerToast(err.message || 'Error updating notes.', 'error');
        } finally {
            setModalLoading(false);
        }
    };

    // Copy SQL Helper
    const copySQLTemplate = () => {
        const sql = `-- Execute in Supabase SQL editor to create a new Admin user
SELECT create_admin_user(
  'newadmin@wordle.com',   -- Admin Email
  'securepassword123',     -- Admin Password
  'admin_name'             -- Admin Username
);`;
        navigator.clipboard.writeText(sql);
        setSqlCopied(true);
        setTimeout(() => setSqlCopied(false), 2000);
        triggerToast('SQL template copied to clipboard!');
    };

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    // RENDER LOADING SCREEN (Auth / Admin status verify)
    if (authLoading || (user && adminLoading)) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
                <RefreshCw className="w-10 h-10 animate-spin text-correct mb-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Authenticating...</span>
            </div>
        );
    }

    // RENDER LOGIN SCREEN (Not logged in)
    if (!user) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center">
                        <div className="inline-flex p-4 rounded-3xl bg-correct/10 border border-correct/20 text-correct mb-6">
                            <Trophy size={40} />
                        </div>
                        <h2 className="text-4xl font-black tracking-tighter text-white uppercase">Admin Vault</h2>
                        <p className="mt-2 text-xs font-bold text-gray-500 uppercase tracking-widest">Staff Authorization Required</p>
                    </div>

                    <div className="bg-gray-900 border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
                        {loginError && (
                            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-xs font-bold text-red-400 text-center uppercase tracking-wide">
                                {loginError}
                            </div>
                        )}

                        <form onSubmit={handleLoginSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest block ml-1">Email Identity</label>
                                <input
                                    type="email"
                                    required
                                    value={loginEmail}
                                    onChange={e => setLoginEmail(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-correct/50 focus:bg-white/5 transition-all text-white placeholder-gray-700"
                                    placeholder="admin@variant.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest block ml-1">Secure Key</label>
                                <input
                                    type="password"
                                    required
                                    value={loginPassword}
                                    onChange={e => setLoginPassword(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-correct/50 focus:bg-white/5 transition-all text-white placeholder-gray-700"
                                    placeholder="••••••••"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loginLoading}
                                className="w-full bg-correct text-black font-black uppercase text-xs tracking-[0.2em] py-5 rounded-2xl transition-all shadow-lg hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                            >
                                {loginLoading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : 'Enter Dashboard'}
                            </button>
                        </form>
                    </div>

                    <div className="text-center">
                        <a href="/" className="inline-flex items-center gap-2 text-[10px] font-black text-gray-600 hover:text-white uppercase tracking-widest transition-all">
                            <Home size={14} /> Back to game
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // RENDER ACCESS DENIED SCREEN (Authenticated but not admin)
    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="w-full max-w-lg text-center space-y-6">
                    <div className="inline-flex p-4 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 mb-2">
                        <Trash2 size={48} />
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter text-white uppercase">Restricted Area</h2>
                    <p className="text-gray-400 font-bold uppercase tracking-wider text-xs leading-relaxed max-w-sm mx-auto">
                        Your account <span className="text-white">({user.email})</span> does not have Staff credentials.
                    </p>
                    <div className="pt-8 flex flex-col items-center gap-4">
                        <button
                            onClick={() => signOut()}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest px-8 py-4 rounded-2xl transition-all"
                        >
                            Sign Out and Try Another Account
                        </button>
                        <a href="/" className="inline-flex items-center gap-2 text-[10px] font-black text-gray-600 hover:text-white uppercase tracking-widest transition-all">
                            <Home size={14} /> Return to Game
                        </a>
                    </div>
                </div>
            </div>
        );
    }

const WordUpTopicsManager = ({ triggerToast }: { triggerToast: (text: string, type?: 'success' | 'error') => void }) => {

    const { data: topics = [], isLoading } = useTopics();
    const saveTopicMutation = useSaveTopicMutation();
    const toggleActiveMutation = useToggleTopicActiveMutation();
    const toggleSuspendedMutation = useToggleTopicSuspendedMutation();

    const [editingTopic, setEditingTopic] = useState<WordUpTopic | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const [formSlug, setFormSlug] = useState('');
    const [formName, setFormName] = useState('');
    const [formEmoji, setFormEmoji] = useState('💡');
    const [formProcedural, setFormProcedural] = useState(0.5);
    const [formWeave, setFormWeave] = useState(0.4);
    const [formVariantWeights, setFormVariantWeights] = useState<number[]>([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const [formIsActive, setFormIsActive] = useState(true);
    const [formIsSuspended, setFormIsSuspended] = useState(false);
    const [formIsDefault, setFormIsDefault] = useState(false);

    const variantNames = [
        "Forward", "Reverse", "Odd One Out", "True/False",
        "Multi-clue", "Correct Error", "Tag Match", "Compare", "Timeline"
    ];

    const openEdit = (t: WordUpTopic) => {
        setEditingTopic(t);
        setIsCreating(false);
        setFormSlug(t.slug);
        setFormName(t.name);
        setFormEmoji(t.emoji || '💡');
        setFormProcedural(t.procedural_weight ?? 0.5);
        setFormWeave(t.handcrafted_weave_probability ?? 0.4);
        setFormVariantWeights(t.variant_weights || [1, 1, 1, 1, 1, 1, 1, 1, 1]);
        setFormIsActive(t.is_active ?? true);
        setFormIsSuspended(t.is_suspended ?? false);
        setFormIsDefault(t.is_default_fallback ?? false);
    };

    const openCreate = () => {
        setEditingTopic(null);
        setIsCreating(true);
        setFormSlug('');
        setFormName('');
        setFormEmoji('💡');
        setFormProcedural(0.5);
        setFormWeave(0.4);
        setFormVariantWeights([1, 1, 1, 1, 1, 1, 1, 1, 1]);
        setFormIsActive(true);
        setFormIsSuspended(false);
        setFormIsDefault(false);
    };

    const handleSave = async () => {
        if (!formSlug.trim() || !formName.trim()) {
            triggerToast("Slug and Name are required.", "error");
            return;
        }
        try {
            await saveTopicMutation.mutateAsync({
                id: editingTopic?.id,
                slug: formSlug.trim().toLowerCase().replace(/\s+/g, '_'),
                name: formName.trim(),
                emoji: formEmoji.trim() || '💡',
                procedural_weight: formProcedural,
                handcrafted_weave_probability: formWeave,
                variant_weights: formVariantWeights,
                is_active: formIsActive,
                is_suspended: formIsSuspended,
                is_default_fallback: formIsDefault,
            });
            triggerToast(editingTopic ? `Updated topic "${formName}"` : `Created topic "${formName}"`, "success");
            setEditingTopic(null);
            setIsCreating(false);
        } catch (err: any) {
            triggerToast(err.message || "Failed to save topic.", "error");
        }
    };

    const handleToggleActive = async (topic: WordUpTopic) => {
        try {
            const next = !topic.is_active;
            await toggleActiveMutation.mutateAsync({ id: topic.id, is_active: next });
            triggerToast(next ? `Activated "${topic.name}"` : `Deactivated "${topic.name}"`, "success");
        } catch {
            triggerToast("Failed to toggle topic status.", "error");
        }
    };

    const handleToggleSuspended = async (topic: WordUpTopic) => {
        try {
            const next = !topic.is_suspended;
            await toggleSuspendedMutation.mutateAsync({ id: topic.id, is_suspended: next });
            triggerToast(next ? `Suspended "${topic.name}"` : `Unsuspended "${topic.name}"`, "success");
        } catch {
            triggerToast("Failed to toggle topic suspension.", "error");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-gray-900 border border-white/10 rounded-2xl p-5">
                <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="text-correct" size={18} /> WordUp Dynamic Topics ({topics.length})
                    </h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                        Manage live procedural weights, handcrafted weave probabilities, suspension, and 9-variant distributions.
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="px-5 py-2.5 bg-correct hover:brightness-110 text-black font-black uppercase text-xs tracking-wider rounded-xl transition-all shadow-lg shadow-correct/20 cursor-pointer"
                >
                    + Add New Topic
                </button>
            </div>

            {(editingTopic || isCreating) && (
                <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">
                            {isCreating ? 'Create New Topic' : `Edit Topic: ${editingTopic?.name}`}
                        </h4>
                        <button
                            onClick={() => { setEditingTopic(null); setIsCreating(false); }}
                            className="p-1 text-gray-500 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Slug</label>
                            <input
                                type="text"
                                value={formSlug}
                                disabled={!!editingTopic}
                                onChange={e => setFormSlug(e.target.value)}
                                placeholder="e.g. physics"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Topic Name</label>
                            <input
                                type="text"
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                                placeholder="e.g. Physics"
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Emoji</label>
                            <input
                                type="text"
                                value={formEmoji}
                                onChange={e => setFormEmoji(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                            />
                        </div>
                    </div>

                    {/* Suspension Toggle Box */}
                    <div className="flex items-center gap-4 bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formIsSuspended}
                                onChange={e => setFormIsSuspended(e.target.checked)}
                                className="w-4 h-4 accent-red-500 cursor-pointer"
                            />
                            <span className="text-xs font-black uppercase tracking-wider text-red-400">
                                Suspend Category (Prevents gameplay selection & routes requests to fallback)
                            </span>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-black/30 p-4 rounded-xl border border-white/5">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Procedural Weight</span>
                                <span className="text-xs font-black text-correct">{Math.round(formProcedural * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={formProcedural}
                                onChange={e => setFormProcedural(Number(e.target.value))}
                                className="w-full accent-correct cursor-pointer"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Handcrafted Weave Probability</span>
                                <span className="text-xs font-black text-purple-400">{Math.round(formWeave * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={formWeave}
                                onChange={e => setFormWeave(Number(e.target.value))}
                                className="w-full accent-purple-400 cursor-pointer"
                            />
                        </div>
                    </div>

                    <div>
                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">9 Variant Relative Weights</h5>
                        <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
                            {variantNames.map((vName, idx) => (
                                <div key={vName} className="bg-white/5 p-2 rounded-xl border border-white/5 text-center">
                                    <span className="text-[9px] font-bold text-gray-400 block truncate" title={vName}>{vName}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="20"
                                        step="0.5"
                                        value={formVariantWeights[idx] ?? 1}
                                        onChange={e => {
                                            const updated = [...formVariantWeights];
                                            updated[idx] = Math.max(0, Number(e.target.value));
                                            setFormVariantWeights(updated);
                                        }}
                                        className="w-full bg-black/60 border border-white/10 rounded-lg text-center text-xs font-bold text-white mt-1 py-1"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => { setEditingTopic(null); setIsCreating(false); }}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saveTopicMutation.isPending}
                            className="px-6 py-2 bg-correct hover:brightness-110 text-black text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-lg shadow-correct/20"
                        >
                            {saveTopicMutation.isPending ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500 font-bold uppercase text-xs animate-pulse">
                        Loading topics...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-white/5 text-[10px] uppercase font-black tracking-wider text-gray-400 border-b border-white/5">
                                <tr>
                                    <th className="py-3.5 px-4">Topic</th>
                                    <th className="py-3.5 px-4">Slug</th>
                                    <th className="py-3.5 px-4">Procedural</th>
                                    <th className="py-3.5 px-4">Weave Prob</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-medium text-gray-300">
                                {topics.map(t => (
                                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                                        <td className="py-3 px-4 font-black text-white flex items-center gap-2">
                                            <span>{t.emoji}</span>
                                            <span>{t.name}</span>
                                            {t.is_suspended && (
                                                <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[9px] font-black uppercase">
                                                    Suspended
                                                </span>
                                            )}
                                            {t.is_default_fallback && (
                                                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[9px] font-black uppercase">
                                                    Default Fallback
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-[11px] text-gray-400">{t.slug}</td>
                                        <td className="py-3 px-4 font-bold text-correct">{Math.round(t.procedural_weight * 100)}%</td>
                                        <td className="py-3 px-4 font-bold text-purple-400">{Math.round(t.handcrafted_weave_probability * 100)}%</td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => handleToggleActive(t)}
                                                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer border transition-all ${
                                                        t.is_active
                                                            ? 'bg-correct/20 text-correct border-correct/30'
                                                            : 'bg-gray-800 text-gray-400 border-gray-700'
                                                    }`}
                                                >
                                                    {t.is_active ? 'Active' : 'Inactive'}
                                                </button>
                                                <button
                                                    onClick={() => handleToggleSuspended(t)}
                                                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer border transition-all ${
                                                        t.is_suspended
                                                            ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20'
                                                            : 'bg-white/5 text-gray-400 hover:text-white border-white/10'
                                                    }`}
                                                >
                                                    {t.is_suspended ? 'Suspended' : 'Suspend'}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button
                                                onClick={() => openEdit(t)}
                                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                                            >
                                                Edit Config
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

            </div>
        </div>
    );
};

    // MAIN DASHBOARD RENDER

    return (
        <div className="h-screen overflow-y-auto bg-black text-white flex flex-col font-sans selection:bg-correct selection:text-black">
            {/* Local Toast Rendering */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-100 px-6 py-3 rounded-2xl shadow-2xl border ${toast.type === 'error' ? 'bg-red-900 border-red-500 text-white' : 'bg-gray-900 border-correct/30 text-correct'} flex items-center gap-3`}
                    >
                        {toast.type === 'error' ? <Flag size={18} /> : <Check size={18} />}
                        <span className="text-xs font-black uppercase tracking-wider">{toast.text}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <header className="border-b border-white/10 bg-black/60 backdrop-blur-xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-correct text-black rounded-xl flex items-center justify-center">
                            <Trophy size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-black uppercase tracking-tighter leading-none">Admin Dashboard</h1>
                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">System Control Unit</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex flex-col items-end mr-2">
                            <span className="text-[10px] font-black text-white uppercase">{user.email?.split('@')[0]}</span>
                            <span className="text-[8px] font-bold text-correct uppercase tracking-widest">Master Admin</span>
                        </div>
                        <button
                            onClick={() => window.location.href = '/word-finder-xyz'}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-amber-400 hover:text-amber-300 p-2 rounded-full transition-all cursor-pointer"
                            title="Word Finder Tool"
                        >
                            <Search size={16} />
                        </button>
                        <button
                            onClick={() => setShowSqlHelper(!showSqlHelper)}
                            className={`p-2 rounded-full border transition-all text-xs font-black flex items-center gap-1.5 cursor-pointer ${showSqlHelper
                                ? 'bg-correct border-correct text-black'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/30'
                                }`}
                            title="SQL Helper"
                        >
                            <FileCode size={16} />
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white p-2 rounded-full transition-all cursor-pointer"
                            title="Return to Home"
                        >
                            <Home size={16} />
                        </button>
                        <button
                            onClick={() => signOut()}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white p-2 rounded-full transition-all cursor-pointer"
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex flex-col gap-6">

                {/* Dashboard Navigation Tabs */}
                <div className="flex items-center gap-2 bg-gray-900 border border-white/10 p-1.5 rounded-2xl self-start">
                    <button
                        onClick={() => setActiveTab('words')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'words'
                            ? 'bg-white text-black shadow-lg shadow-white/5'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        <FileCode size={14} /> Word Vetting
                    </button>
                    <button
                        onClick={() => setActiveTab('marathon')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'marathon'
                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        <Trophy size={14} /> Bot Marathon
                    </button>
                    <button
                        onClick={() => setActiveTab('wordup')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'wordup'
                            ? 'bg-correct text-black shadow-lg shadow-correct/25'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        <Image size={14} /> WordUp Curator
                    </button>
                    <button
                        onClick={() => setActiveTab('topics')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'topics'
                            ? 'bg-correct text-black shadow-lg shadow-correct/25'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        <BookOpen size={14} /> Topic Hub
                    </button>
                    <button
                        onClick={() => setActiveTab('dynamic_topics')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'dynamic_topics'
                            ? 'bg-correct text-black shadow-lg shadow-correct/25'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        <Sparkles size={14} /> Dynamic Topics
                    </button>

                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'stats'
                            ? 'bg-correct text-black shadow-lg shadow-correct/25'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        <BarChart2 size={14} /> Game Stats
                    </button>
                    <button
                        onClick={() => setActiveTab('telemetry')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'telemetry'
                            ? 'bg-correct text-black shadow-lg shadow-correct/25'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        <Activity size={14} /> Telemetry
                    </button>
                    <button
                        onClick={() => setActiveTab('broadcast')}
                        className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${activeTab === 'broadcast'
                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                            : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        <Bell size={14} /> Broadcast
                    </button>
                </div>


                {activeTab === 'words' ? (
                    <>
                        {/* SQL Helper Code Block Panel */}
                        <AnimatePresence>
                            {showSqlHelper && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 mb-2 relative">
                                        <button
                                            onClick={() => setShowSqlHelper(false)}
                                            className="absolute top-4 right-4 text-gray-500 hover:text-white cursor-pointer"
                                        >
                                            <X size={18} />
                                        </button>
                                        <h3 className="text-xs font-black uppercase tracking-wider text-white mb-2 flex items-center gap-2">
                                            <BookOpen size={14} className="text-correct" />
                                            PostgreSQL: Registering New Admins
                                        </h3>
                                        <p className="text-[11px] text-gray-400 mb-4 uppercase font-bold tracking-wide">
                                            Run this query in your Supabase SQL Editor to create additional admin users.
                                        </p>
                                        <div className="relative">
                                            <pre className="bg-black/60 text-correct border border-white/5 rounded-xl p-4 text-[11px] font-mono overflow-x-auto whitespace-pre leading-relaxed select-all">
                                                {`-- Execute in Supabase SQL editor to create a new Admin user
SELECT create_admin_user(
  'newadmin@wordle.com',   -- Admin Email
  'securepassword123',     -- Admin Password
  'admin_name'             -- Admin Username
);`}
                                            </pre>
                                            <button
                                                onClick={copySQLTemplate}
                                                className="absolute top-3 right-3 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-gray-300 font-black uppercase px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                                            >
                                                {sqlCopied ? <Check size={12} className="text-correct" /> : <Copy size={12} />}
                                                {sqlCopied ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Dashboard stats cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">3-Letter Words (Official)</span>
                                    <h4 className="text-3xl font-black mt-1 text-white">{WORDS_3.length}</h4>
                                </div>
                                <div className="bg-white/5 p-3 rounded-xl text-gray-400">
                                    <span className="font-mono text-sm font-black">3L</span>
                                </div>
                            </div>

                            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">4-Letter Words (Official)</span>
                                    <h4 className="text-3xl font-black mt-1 text-white">{WORDS_4.length}</h4>
                                </div>
                                <div className="bg-white/5 p-3 rounded-xl text-gray-400">
                                    <span className="font-mono text-sm font-black">4L</span>
                                </div>
                            </div>

                            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Flagged Review Words</span>
                                    <h4 className="text-3xl font-black mt-1 text-red-400">
                                        {loadingFlags ? <RefreshCw className="w-5 h-5 animate-spin inline-block text-red-400" /> : flaggedMap.size}
                                    </h4>
                                </div>
                                <div className="bg-red-500/10 p-3 rounded-xl text-red-400 border border-red-500/20">
                                    <Flag size={20} />
                                </div>
                            </div>

                            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Active Push Devices</span>
                                    <h4 className="text-3xl font-black mt-1 text-indigo-400">
                                        {pushSubCount === null ? <RefreshCw className="w-5 h-5 animate-spin inline-block text-indigo-400" /> : pushSubCount}
                                    </h4>
                                </div>
                                <div className="bg-indigo-500/10 p-3 rounded-xl text-indigo-400 border border-indigo-500/20">
                                    <Bell size={20} />
                                </div>
                            </div>
                        </div>

                        {/* Control Panel Filter Area */}
                        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex flex-col gap-5">
                            {/* First row: Tabs & Selectors */}
                            <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                                {/* Word Length Selector */}
                                <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 self-start">
                                    <button
                                        onClick={() => setActiveLength(3)}
                                        className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeLength === 3
                                            ? 'bg-correct text-black shadow-md'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        3-Letter Words
                                    </button>
                                    <button
                                        onClick={() => setActiveLength(4)}
                                        className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${activeLength === 4
                                            ? 'bg-correct text-black shadow-md'
                                            : 'text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        4-Letter Words
                                    </button>
                                </div>

                                {/* Status Filters */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => setFilterType('all')}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${filterType === 'all'
                                            ? 'bg-white border-white text-black'
                                            : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        All Words ({processedWords.length})
                                    </button>
                                    <button
                                        onClick={() => setFilterType('flagged')}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${filterType === 'flagged'
                                            ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20'
                                            : 'bg-red-500/5 border-red-500/10 text-red-400 hover:bg-red-500/10'
                                            }`}
                                    >
                                        <Flag size={12} /> Flagged
                                    </button>
                                    <button
                                        onClick={() => setFilterType('unflagged')}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${filterType === 'unflagged'
                                            ? 'bg-correct border-correct text-black shadow-lg shadow-correct/20'
                                            : 'bg-correct/5 border-correct/10 text-correct hover:bg-correct/10'
                                            }`}
                                    >
                                        <Check size={12} /> Safe
                                    </button>

                                    <button
                                        onClick={fetchFlaggedWords}
                                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white p-2 rounded-xl transition-all ml-auto lg:ml-0 cursor-pointer"
                                        title="Refresh Flags Data"
                                        disabled={loadingFlags}
                                    >
                                        <RefreshCw size={14} className={loadingFlags ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>

                            {/* Second Row: Search, Sort and Letter Buttons */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Search Input */}
                                <div className="relative group col-span-1 md:col-span-2">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-correct transition-colors" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search word..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-correct/50 focus:bg-white/5 transition-all text-white placeholder-gray-600"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>

                                {/* Sort selector */}
                                <div className="relative">
                                    <select
                                        value={sortBy}
                                        onChange={e => setSortBy(e.target.value as any)}
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-correct/50 focus:bg-white/5 transition-all text-white appearance-none cursor-pointer"
                                    >
                                        <option value="alpha-asc" className="bg-gray-900 text-white">Alphabetical (A - Z)</option>
                                        <option value="alpha-desc" className="bg-gray-900 text-white">Alphabetical (Z - A)</option>
                                        <option value="flagged-first" className="bg-gray-900 text-white">Flagged First</option>
                                        <option value="unflagged-first" className="bg-gray-900 text-white">Verified First</option>
                                    </select>
                                    <ArrowUpDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                                </div>
                            </div>

                            {/* A-Z Start-Letter selectors */}
                            <div className="border-t border-white/5 pt-4">
                                <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider block mb-2">Filter by Starting Letter</span>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        onClick={() => setStartLetter(null)}
                                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${startLetter === null
                                            ? 'bg-correct border-correct text-black'
                                            : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        ALL
                                    </button>
                                    {alphabet.map((letter) => {
                                        const countForLetter = wordsSource.filter(w => w.startsWith(letter)).length;
                                        if (countForLetter === 0) return null;

                                        return (
                                            <button
                                                key={letter}
                                                onClick={() => setStartLetter(startLetter === letter ? null : letter)}
                                                className={`w-7.5 h-7.5 rounded-lg text-[10px] font-black border transition-all flex items-center justify-center cursor-pointer ${startLetter === letter
                                                    ? 'bg-correct border-correct text-black shadow-md'
                                                    : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                                                    }`}
                                                title={`${countForLetter} words`}
                                            >
                                                {letter}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Main Words Table Card */}
                        <div className="bg-gray-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-white/2 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                            <th className="py-4 px-6">Word</th>
                                            <th className="py-4 px-6">Status</th>
                                            <th className="py-4 px-6">Review Notes / Reasons</th>
                                            <th className="py-4 px-6">Flagged By</th>
                                            <th className="py-4 px-6 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {paginatedWords.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-12 text-center text-gray-500 font-bold uppercase tracking-wider text-xs">
                                                    No matching words found for this filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedWords.map((word) => {
                                                const isFlagged = flaggedMap.has(word);
                                                const flagData = flaggedMap.get(word);

                                                return (
                                                    <tr key={word} className={`hover:bg-white/2 transition-colors ${isFlagged ? 'bg-red-500/2' : ''}`}>
                                                        {/* Word */}
                                                        <td className="py-4 px-6">
                                                            <span className="font-mono text-sm font-black uppercase tracking-widest text-white">
                                                                {word}
                                                            </span>
                                                        </td>

                                                        {/* Status Badge */}
                                                        <td className="py-4 px-6">
                                                            {isFlagged ? (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase bg-red-500/10 border border-red-500/30 text-red-400">
                                                                    <Flag size={10} className="fill-current" /> Flagged
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase bg-white/5 border border-white/5 text-gray-500">
                                                                    Verified
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Reason / Notes */}
                                                        <td className="py-4 px-6 max-w-xs xl:max-w-md">
                                                            {isFlagged && flagData ? (
                                                                <span className="text-[11px] font-medium text-gray-300 block truncate" title={flagData.reason || 'No reason provided'}>
                                                                    {flagData.reason || <span className="italic text-gray-600">No notes provided</span>}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-700 italic">—</span>
                                                            )}
                                                        </td>

                                                        {/* Flagged By */}
                                                        <td className="py-4 px-6">
                                                            {isFlagged && flagData ? (
                                                                <div className="flex items-center gap-1.5 text-gray-400">
                                                                    <User size={12} className="text-gray-500" />
                                                                    <span className="text-[10px] font-bold uppercase">
                                                                        {flagData.admin_profile?.username || 'Unknown'}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-700 italic">—</span>
                                                            )}
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="py-4 px-6 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {isFlagged ? (
                                                                    <>
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedWord(word);
                                                                                setReviewReason(flagData?.reason || '');
                                                                                setActiveModal('edit');
                                                                            }}
                                                                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                                                                            title="Edit Notes"
                                                                        >
                                                                            <Edit2 size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => deleteFlag(word)}
                                                                            className="p-2.5 rounded-xl bg-correct/5 hover:bg-correct/10 text-correct/60 hover:text-correct transition-all cursor-pointer"
                                                                            title="Unflag Word"
                                                                        >
                                                                            <Check size={14} />
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedWord(word);
                                                                            setActiveModal('flag');
                                                                        }}
                                                                        className="p-2.5 rounded-xl bg-red-500/5 hover:bg-red-500/10 text-red-500/40 hover:text-red-400 transition-all cursor-pointer"
                                                                        title="Flag Word"
                                                                    >
                                                                        <Flag size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="px-6 py-5 border-t border-white/10 bg-white/2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider text-center sm:text-left">
                                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, processedWords.length)} of {processedWords.length} words
                                    </span>
                                    <div className="flex items-center justify-center gap-1.5">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>

                                        {/* Pages representation */}
                                        {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                                            // Make page numbers pivot around current page
                                            let pageNum = idx + 1;
                                            if (currentPage > 3 && totalPages > 5) {
                                                if (currentPage + 2 <= totalPages) {
                                                    pageNum = currentPage - 2 + idx;
                                                } else {
                                                    pageNum = totalPages - 4 + idx;
                                                }
                                            }

                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`w-9.5 h-9.5 text-[10px] font-black rounded-xl border transition-all flex items-center justify-center cursor-pointer ${currentPage === pageNum
                                                        ? 'bg-correct border-correct text-black shadow-md shadow-correct/10'
                                                        : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}

                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : activeTab === 'marathon' ? (
                    <BotMarathonManagement triggerToast={triggerToast} />
                ) : activeTab === 'wordup' ? (
                    <WordUpCurator triggerToast={triggerToast} />
                ) : activeTab === 'topics' ? (
                    <TopicHub triggerToast={triggerToast} />
                ) : activeTab === 'dynamic_topics' ? (
                    <WordUpTopicsManager triggerToast={triggerToast} />
                ) : activeTab === 'telemetry' ? (
                    <AnonymizedTelemetrySection triggerToast={triggerToast} />
                ) : activeTab === 'broadcast' ? (

                    <AdminCustomNotificationBroadcaster triggerToast={triggerToast} />
                ) : (
                    <GameStats triggerToast={triggerToast} />
                )}

            </main>

            {/* FLAG REVIEW / EDIT REASON DIALOG MODAL */}
            <AnimatePresence>
                {activeModal !== null && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="bg-gray-900 border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl relative"
                        >
                            <button
                                onClick={() => {
                                    setActiveModal(null);
                                    setSelectedWord(null);
                                    setReviewReason('');
                                }}
                                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white cursor-pointer"
                            >
                                <X size={20} />
                            </button>

                            <div className="mb-6 flex items-center gap-3">
                                <div className={`p-3 rounded-full border ${activeModal === 'flag' ? 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400' : 'bg-correct/10 border-correct/20 text-correct'}`}>
                                    <Flag size={20} className={activeModal === 'flag' ? 'fill-current' : ''} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tighter text-white">
                                        {activeModal === 'flag' ? 'Flag Word for Review' : 'Edit Flag Review Details'}
                                    </h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                                        Word: <span className="font-mono text-white text-xs font-black tracking-widest">{selectedWord}</span>
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">
                                        Reason / Notes (Optional)
                                    </label>
                                    <textarea
                                        rows={4}
                                        placeholder="Obscure word, outdated, typo in word list, inappropriate..."
                                        value={reviewReason}
                                        onChange={e => setReviewReason(e.target.value)}
                                        disabled={modalLoading}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-correct/50 focus:bg-white/10 transition-all text-white placeholder-gray-600 resize-none font-sans"
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setActiveModal(null);
                                            setSelectedWord(null);
                                            setReviewReason('');
                                        }}
                                        disabled={modalLoading}
                                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest py-3.5 rounded-2xl transition-all cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={activeModal === 'flag' ? submitFlag : submitEditReason}
                                        disabled={modalLoading}
                                        className={`flex-1 ${activeModal === 'flag' ? 'bg-yellow-500 text-black' : 'bg-correct text-black'} font-black uppercase text-[10px] tracking-widest py-3.5 rounded-2xl transition-all shadow-lg hover:brightness-110 disabled:opacity-50 cursor-pointer`}
                                    >
                                        {modalLoading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : (activeModal === 'flag' ? 'Flag Word' : 'Save Changes')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
