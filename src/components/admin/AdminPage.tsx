import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Search, 
    Flag, 
    Trash2, 
    LogOut, 
    ChevronLeft, 
    ChevronRight, 
    RefreshCw, 
    Copy, 
    Check, 
    Shield, 
    AlertCircle, 
    ArrowUpDown, 
    User,
    BookOpen,
    Edit2,
    Home,
    X,
    FileCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useAdminStatus } from '../../hooks/useAdminStatus';
import { getWORDS_3, getWORDS_4 } from '../../data/words';
import { supabase } from '../../lib/supabaseClient';

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

export const AdminPage: React.FC = () => {
    const WORDS_3 = useMemo(() => getWORDS_3(), []);
    const WORDS_4 = useMemo(() => getWORDS_4(), []);

    const { user, loading: authLoading, signInWithEmail, signOut } = useAuth();
    const { isAdmin, loading: adminLoading } = useAdminStatus(user?.id);

    // Authentication States
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);

    // Dashboard Data States
    const [activeLength, setActiveLength] = useState<3 | 4>(3);
    const [flaggedMap, setFlaggedMap] = useState<Map<string, FlaggedWordData>>(new Map());
    const [loadingFlags, setLoadingFlags] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'flagged' | 'unflagged'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [startLetter, setStartLetter] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'alpha-asc' | 'alpha-desc' | 'flagged-first' | 'unflagged-first'>('alpha-asc');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // Flag / Edit Dialog State
    const [activeModal, setActiveModal] = useState<'flag' | 'edit' | null>(null);
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [reviewReason, setReviewReason] = useState('');
    const [modalLoading, setModalLoading] = useState(false);

    // Copy SQL state
    const [sqlCopied, setSqlCopied] = useState(false);
    const [showSqlHelper, setShowSqlHelper] = useState(false);

    // Notification toast
    const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const triggerToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
        setToastMsg({ text, type });
        setTimeout(() => {
            setToastMsg(null);
        }, 3000);
    }, []);

    // Load flagged words database mapping
    const fetchFlaggedWords = useCallback(async () => {
        if (!user || !isAdmin) return;
        setLoadingFlags(true);
        try {
            const { data, error } = await supabase
                .from('flagged_words')
                .select('*, admin_profile:flagged_by(username)');

            if (error) {
                console.error('Error fetching flagged words:', error);
                triggerToast('Failed to load flagged status from DB', 'error');
            } else {
                const map = new Map<string, FlaggedWordData>();
                data?.forEach((row: any) => {
                    map.set(row.word.toUpperCase(), row);
                });
                setFlaggedMap(map);
            }
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoadingFlags(false);
        }
    }, [user, isAdmin, triggerToast]);

    // Fetch flagged words on mount or auth status change
    useEffect(() => {
        if (user && isAdmin) {
            fetchFlaggedWords();
        }
    }, [user, isAdmin, fetchFlaggedWords]);

    // Handle standard Admin Login
    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginEmail || !loginPassword) return;

        setLoginLoading(true);
        setLoginError(null);
        try {
            const { error } = await signInWithEmail(loginEmail, loginPassword);
            if (error) {
                setLoginError(error.message);
            } else {
                triggerToast('Welcome back, Admin!');
            }
        } catch (err: any) {
            setLoginError(err.message || 'An error occurred during login');
        } finally {
            setLoginLoading(false);
        }
    };

    // Words lists matching current selected length
    const wordsSource = useMemo(() => {
        return activeLength === 3 ? WORDS_3 : WORDS_4;
    }, [activeLength]);

    // Filtered and Sorted words to display
    const processedWords = useMemo(() => {
        let results = [...wordsSource];

        // 1. Start Letter Filter
        if (startLetter) {
            results = results.filter(w => w.startsWith(startLetter.toUpperCase()));
        }

        // 2. Search Query Filter
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toUpperCase();
            results = results.filter(w => w.includes(q));
        }

        // 3. Status Filters (Flagged / Unflagged)
        if (filterType === 'flagged') {
            results = results.filter(w => flaggedMap.has(w));
        } else if (filterType === 'unflagged') {
            results = results.filter(w => !flaggedMap.has(w));
        }

        // 4. Sorting logic
        results.sort((a, b) => {
            const isAFlagged = flaggedMap.has(a);
            const isBFlagged = flaggedMap.has(b);

            switch (sortBy) {
                case 'alpha-asc':
                    return a.localeCompare(b);
                case 'alpha-desc':
                    return b.localeCompare(a);
                case 'flagged-first':
                    if (isAFlagged && !isBFlagged) return -1;
                    if (!isAFlagged && isBFlagged) return 1;
                    return a.localeCompare(b);
                case 'unflagged-first':
                    if (!isAFlagged && isBFlagged) return -1;
                    if (isAFlagged && !isBFlagged) return 1;
                    return a.localeCompare(b);
                default:
                    return 0;
            }
        });

        return results;
    }, [wordsSource, startLetter, searchQuery, filterType, flaggedMap, sortBy]);

    // Reset pagination when filter/search/length changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeLength, filterType, searchQuery, startLetter, sortBy]);

    // Page items slicing
    const paginatedWords = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return processedWords.slice(startIndex, startIndex + itemsPerPage);
    }, [processedWords, currentPage]);

    const totalPages = Math.ceil(processedWords.length / itemsPerPage);

    // Flag submission handler
    const submitFlag = async () => {
        if (!selectedWord || !user) return;
        setModalLoading(true);
        try {
            const { error } = await supabase
                .from('flagged_words')
                .insert([{
                    word: selectedWord.toUpperCase(),
                    word_length: selectedWord.length,
                    flagged_by: user.id,
                    reason: reviewReason.trim() || null
                }]);

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
            triggerToast(err.message || 'Error executing flag.', 'error');
        } finally {
            setModalLoading(false);
        }
    };

    // Unflag review handler
    const deleteFlag = async (word: string) => {
        const confirmed = window.confirm(`Are you sure you want to remove the review flag for "${word}"?`);
        if (!confirmed) return;

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
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">Verifying Admin Rights...</span>
            </div>
        );
    }

    // RENDER LOGIN SCREEN (Unauthenticated)
    if (!user) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-correct/10 rounded-full border border-correct/20">
                            <Shield className="w-12 h-12 text-correct" />
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Admin Access</h2>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                            Vetting word lists requires special credentials
                        </p>
                    </div>

                    {loginError && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[11px] font-bold text-red-400 uppercase tracking-wide text-center">
                            {loginError}
                        </div>
                    )}

                    <form onSubmit={handleLoginSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">Admin Email</label>
                            <input
                                type="email"
                                required
                                placeholder="admin@example.com"
                                value={loginEmail}
                                onChange={e => setLoginEmail(e.target.value)}
                                disabled={loginLoading}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-sm focus:outline-none focus:border-correct/50 focus:bg-white/10 transition-all text-white placeholder-gray-600"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">Password</label>
                            <input
                                type="password"
                                required
                                placeholder="••••••••"
                                value={loginPassword}
                                onChange={e => setLoginPassword(e.target.value)}
                                disabled={loginLoading}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-sm focus:outline-none focus:border-correct/50 focus:bg-white/10 transition-all text-white placeholder-gray-600"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loginLoading}
                            className="w-full bg-correct text-black font-black uppercase text-xs tracking-widest py-4 rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg shadow-correct/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {loginLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Log In As Admin'}
                        </button>
                    </form>

                    <div className="mt-8 text-center border-t border-white/5 pt-4">
                        <a href="/" className="inline-flex items-center gap-2 text-xs font-black text-gray-400 hover:text-white uppercase tracking-wider transition-colors">
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
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
                            <AlertCircle className="w-12 h-12 text-red-500" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">Access Denied</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-6">
                        Logged in as: <span className="text-white normal-case font-medium">{user.email}</span>
                    </p>

                    <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 mb-8 text-[11px] font-bold text-gray-400 uppercase tracking-wide leading-relaxed">
                        This account is not configured with administrator rights. If you believe this is an error, insert your user UUID into the <code className="text-red-400 font-mono normal-case">admin_profile</code> table.
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => signOut()}
                            className="w-full bg-white/5 hover:bg-white/10 text-red-400 border border-white/10 font-black uppercase text-xs tracking-widest py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <LogOut size={16} /> Sign Out / Switch User
                        </button>
                        <a
                            href="/"
                            className="w-full bg-white text-black font-black uppercase text-xs tracking-widest py-3.5 rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                        >
                            <Home size={16} /> Return to Game
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // RENDER ADMIN DASHBOARD (Authenticated and Admin)
    return (
        <div className="min-h-screen h-screen overflow-y-auto bg-black text-white font-sans flex flex-col">
            {/* Local Toast Alert */}
            <AnimatePresence>
                {toastMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl shadow-xl border text-xs font-black uppercase tracking-wider flex items-center gap-2.5 ${
                            toastMsg.type === 'success' 
                                ? 'bg-correct/10 border-correct/30 text-correct' 
                                : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}
                    >
                        {toastMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                        {toastMsg.text}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Top Navigation Header */}
            <header className="border-b border-white/10 bg-gray-900/60 backdrop-blur-md sticky top-0 z-40 px-4 py-3 sm:px-6">
                <div className="max-w-7xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-correct/10 px-3 py-1.5 rounded-full border border-correct/20 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-correct" />
                            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">
                                Wordle Admin
                            </h1>
                        </div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                            Vetting Portal
                        </span>
                    </div>

                    <div className="flex items-center gap-3 justify-end">
                        <div className="hidden md:flex items-center gap-2 bg-white/5 pl-2 pr-4 py-1.5 rounded-full border border-white/10">
                            <div className="w-5 h-5 rounded-full bg-correct/20 flex items-center justify-center text-[9px] font-black text-correct">
                                AD
                            </div>
                            <span className="text-[10px] font-black uppercase text-gray-400">
                                {user.email?.split('@')[0]}
                            </span>
                        </div>

                        <button
                            onClick={() => setShowSqlHelper(!showSqlHelper)}
                            className={`p-2 rounded-full border transition-all text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                                showSqlHelper 
                                    ? 'bg-correct/20 border-correct/40 text-correct' 
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                            }`}
                            title="Template SQL Helper"
                        >
                            <FileCode size={16} />
                            <span className="hidden sm:inline">SQL Helper</span>
                        </button>

                        <a
                            href="/"
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white p-2 rounded-full transition-all flex items-center justify-center"
                            title="Return to Game"
                        >
                            <Home size={16} />
                        </a>

                        <button
                            onClick={() => signOut()}
                            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                        >
                            <LogOut size={12} /> Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
                
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
                                    className="absolute top-4 right-4 text-gray-500 hover:text-white"
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                </div>

                {/* Control Panel Filter Area */}
                <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 flex flex-col gap-5">
                    {/* First row: Tabs & Selectors */}
                    <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                        {/* Word Length Selector */}
                        <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 self-start">
                            <button
                                onClick={() => setActiveLength(3)}
                                className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    activeLength === 3 
                                        ? 'bg-correct text-black shadow-md' 
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                3-Letter Words
                            </button>
                            <button
                                onClick={() => setActiveLength(4)}
                                className={`px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    activeLength === 4 
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
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                    filterType === 'all'
                                        ? 'bg-white border-white text-black'
                                        : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                                }`}
                            >
                                All Words ({processedWords.length})
                            </button>
                            <button
                                onClick={() => setFilterType('flagged')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
                                    filterType === 'flagged'
                                        ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20'
                                        : 'bg-red-500/5 border-red-500/10 text-red-400 hover:bg-red-500/10'
                                }`}
                            >
                                <Flag size={12} /> Flagged
                            </button>
                            <button
                                onClick={() => setFilterType('unflagged')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 cursor-pointer ${
                                    filterType === 'unflagged'
                                        ? 'bg-green-500 border-green-500 text-black font-black'
                                        : 'bg-green-500/5 border-green-500/10 text-green-400 hover:bg-green-500/10'
                                }`}
                            >
                                Verified
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
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
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
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                    startLetter === null
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
                                        className={`w-7.5 h-7.5 rounded-lg text-[10px] font-black border transition-all flex items-center justify-center cursor-pointer ${
                                            startLetter === letter
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
                                                    {isFlagged ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedWord(word);
                                                                    setReviewReason(flagData?.reason || '');
                                                                    setActiveModal('edit');
                                                                }}
                                                                className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all flex items-center justify-center cursor-pointer"
                                                                title="Edit Note"
                                                            >
                                                                <Edit2 size={13} />
                                                            </button>
                                                            <button
                                                                onClick={() => deleteFlag(word)}
                                                                className="p-2 text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                                                                title="Remove Flag"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedWord(word);
                                                                setReviewReason('');
                                                                setActiveModal('flag');
                                                            }}
                                                            className="px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-yellow-400 hover:text-black bg-yellow-400/5 hover:bg-yellow-400 border border-yellow-400/20 hover:border-yellow-400 rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                                        >
                                                            <Flag size={11} /> Flag Review
                                                        </button>
                                                    )}
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
                                            className={`w-9.5 h-9.5 text-[10px] font-black rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                                                currentPage === pageNum
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
                                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
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
                                        className={`flex-1 font-black uppercase text-[10px] tracking-widest py-3.5 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                                            activeModal === 'flag' 
                                                ? 'bg-yellow-400 text-black shadow-yellow-400/10' 
                                                : 'bg-correct text-black shadow-correct/10'
                                        }`}
                                    >
                                        {modalLoading ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : activeModal === 'flag' ? (
                                            'Confirm Flag'
                                        ) : (
                                            'Save Changes'
                                        )}
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
