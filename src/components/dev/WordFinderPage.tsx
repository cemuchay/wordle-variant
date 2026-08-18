import React, { useState, useEffect, useMemo } from 'react';
import { loadWordLists } from '../../data/words';
import { Search, Filter, RefreshCw, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminStatus } from '../../hooks/useAdminStatus';

type ListType = 'official' | 'allowed';

export const WordFinderPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminStatus(user?.id);

  const [wordLength, setWordLength] = useState<number>(() => {
    const saved = sessionStorage.getItem('wf_wordLength');
    return saved ? Number(saved) : 5;
  });
  const [listType, setListType] = useState<ListType>(() => {
    const saved = sessionStorage.getItem('wf_listType');
    return (saved as ListType) || 'official';
  });
  const [words, setWords] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Search mode 1: Unscramble / Letters pool search
  const [mode1Type, setMode1Type] = useState<'starting' | 'ending' | 'containing' | 'exact_anagram'>(() => {
    const saved = sessionStorage.getItem('wf_mode1Type');
    return (saved as any) || 'starting';
  });
  const [mode1Letters, setMode1Letters] = useState<string>(() => {
    return sessionStorage.getItem('wf_mode1Letters') || '';
  });

  // Search mode 2: Fill-in-the-blanks / Positional search
  const [slots, setSlots] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('wf_slots');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return Array(5).fill('');
  });
  const [yellowSlots, setYellowSlots] = useState<string[]>(() => {
    const saved = sessionStorage.getItem('wf_yellowSlots');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return Array(5).fill('');
  });

  // Common Filters
  const [excludeLetters, setExcludeLetters] = useState<string>(() => {
    return sessionStorage.getItem('wf_excludeLetters') || '';
  });
  const [mustContainLetters, setMustContainLetters] = useState<string>(() => {
    return sessionStorage.getItem('wf_mustContainLetters') || '';
  });
  const [excludeWordsInput, setExcludeWordsInput] = useState<string>(() => {
    return sessionStorage.getItem('wf_excludeWordsInput') || '';
  });

  // Save states to sessionStorage
  useEffect(() => { sessionStorage.setItem('wf_wordLength', String(wordLength)); }, [wordLength]);
  useEffect(() => { sessionStorage.setItem('wf_listType', listType); }, [listType]);
  useEffect(() => { sessionStorage.setItem('wf_mode1Type', mode1Type); }, [mode1Type]);
  useEffect(() => { sessionStorage.setItem('wf_mode1Letters', mode1Letters); }, [mode1Letters]);
  useEffect(() => { sessionStorage.setItem('wf_slots', JSON.stringify(slots)); }, [slots]);
  useEffect(() => { sessionStorage.setItem('wf_yellowSlots', JSON.stringify(yellowSlots)); }, [yellowSlots]);
  useEffect(() => { sessionStorage.setItem('wf_excludeLetters', excludeLetters); }, [excludeLetters]);
  useEffect(() => { sessionStorage.setItem('wf_mustContainLetters', mustContainLetters); }, [mustContainLetters]);
  useEffect(() => { sessionStorage.setItem('wf_excludeWordsInput', excludeWordsInput); }, [excludeWordsInput]);

  // Update slots arrays when word length changes
  useEffect(() => {
    setSlots((prev) => {
      if (prev.length === wordLength) return prev;
      const next = Array(wordLength).fill('');
      for (let i = 0; i < Math.min(prev.length, wordLength); i++) {
        next[i] = prev[i];
      }
      return next;
    });
    setYellowSlots((prev) => {
      if (prev.length === wordLength) return prev;
      const next = Array(wordLength).fill('');
      for (let i = 0; i < Math.min(prev.length, wordLength); i++) {
        next[i] = prev[i];
      }
      return next;
    });
  }, [wordLength]);

  // Load word lists when length or listType changes
  useEffect(() => {
    let active = true;
    if (!words.length) setLoading(true);
    loadWordLists(wordLength, false)
      .then((data) => {
        if (!active) return;
        if (listType === 'official') {
          setWords(data.official);
        } else {
          setWords(Array.from(data.valid).sort());
        }
      })
      .catch((err) => {
        console.error('Failed to load words for Word Finder', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [wordLength, listType]);

  // Parse excluded words
  const excludedWordsSet = useMemo(() => {
    const tokens = excludeWordsInput
      .toUpperCase()
      .split(/[\s,;]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    return new Set(tokens);
  }, [excludeWordsInput]);

  // Filter calculation
  const filteredWords = useMemo(() => {
    if (loading || !words.length) return [];

    const mode1Query = mode1Letters.trim().toUpperCase();
    const excludeSet = new Set(
      excludeLetters
        .toUpperCase()
        .split(/[\s,;]+/)
        .join('')
        .replace(/[^A-Z]/g, '')
        .split('')
    );
    const mustContainArr = mustContainLetters
      .toUpperCase()
      .split(/[\s,;]+/)
      .join('')
      .replace(/[^A-Z]/g, '')
      .split('');

    // Letters that are in BOTH mustContain and excludeSet have an exact known count
    // (Equal to how many times they appear in mustContainArr)
    const exactCounts = new Map<string, number>();
    const pureExcludeSet = new Set<string>();

    excludeSet.forEach((char) => {
      const requiredCount = mustContainArr.filter((c) => c === char).length;
      if (requiredCount > 0) {
        exactCounts.set(char, requiredCount);
      } else {
        pureExcludeSet.add(char);
      }
    });

    return words.filter((word) => {
      // Excluded words filter
      if (excludedWordsSet.has(word)) return false;

      // Pure exclude letters filter (0 occurrences allowed)
      for (let i = 0; i < word.length; i++) {
        if (pureExcludeSet.has(word[i])) return false;
      }

      // Must contain letters filter (at least N occurrences)
      for (const char of mustContainArr) {
        if (!word.includes(char)) return false;
      }

      // Exact count constraint (e.g. letter in both mustContain and exclude means EXACTLY N occurrences, no duplicate)
      for (const [char, exactCount] of exactCounts.entries()) {
        const actualCount = word.split('').filter((c) => c === char).length;
        if (actualCount !== exactCount) return false;
      }

      // Fill-in-the-blanks green positional match (correct position)
      for (let i = 0; i < wordLength; i++) {
        const slotChar = slots[i]?.trim().toUpperCase();
        if (slotChar && slotChar !== word[i]) {
          return false;
        }
      }

      // Fill-in-the-blanks yellow positional match (in word, but NOT in position i)
      for (let i = 0; i < wordLength; i++) {
        const yellowChars = yellowSlots[i]?.trim().toUpperCase();
        if (yellowChars) {
          for (let j = 0; j < yellowChars.length; j++) {
            const ch = yellowChars[j];
            if (!word.includes(ch)) return false;
            if (word[i] === ch) return false;
          }
        }
      }

      // Mode 1: Letters pool / Substring filter
      if (mode1Query) {
        if (mode1Type === 'starting') {
          if (!word.startsWith(mode1Query)) return false;
        } else if (mode1Type === 'ending') {
          if (!word.endsWith(mode1Query)) return false;
        } else if (mode1Type === 'containing') {
          if (!word.includes(mode1Query)) return false;
        } else if (mode1Type === 'exact_anagram') {
          // Can be formed from these letters pool
          const pool = mode1Query.split('');
          const wordChars = word.split('');
          for (const ch of wordChars) {
            const idx = pool.indexOf(ch);
            if (idx === -1) return false;
            pool.splice(idx, 1);
          }
        }
      }

      return true;
    });
  }, [words, loading, mode1Letters, mode1Type, slots, yellowSlots, wordLength, excludeLetters, mustContainLetters, excludedWordsSet]);

  const handleSlotChange = (index: number, val: string) => {
    const char = val.slice(-1).toUpperCase();
    const next = [...slots];
    next[index] = char;
    setSlots(next);
  };

  const handleYellowSlotChange = (index: number, val: string) => {
    const chars = val.toUpperCase().replace(/[^A-Z]/g, '');
    const next = [...yellowSlots];
    next[index] = chars;
    setYellowSlots(next);
  };

  const clearAll = () => {
    setMode1Letters('');
    setSlots(Array(wordLength).fill(''));
    setYellowSlots(Array(wordLength).fill(''));
    setExcludeLetters('');
    setMustContainLetters('');
    setExcludeWordsInput('');
    ['wf_mode1Letters', 'wf_slots', 'wf_yellowSlots', 'wf_excludeLetters', 'wf_mustContainLetters', 'wf_excludeWordsInput'].forEach((k) => sessionStorage.removeItem(k));
  };

  // Unique words test & elimination candidates when remaining words < 100
  const eliminationCandidates = useMemo(() => {
    if (loading || filteredWords.length < 2 || filteredWords.length >= 100) {
      return null;
    }

    // 1. Identify letters that differ among remaining possible candidate words
    const letterPositions = Array.from({ length: wordLength }, (_, i) => i);
    const variablePositions: number[] = [];
    const distinguishingLetters = new Set<string>();

    // Collect all unique characters present in the remaining candidate words
    const candidateLetterCounts = new Map<string, number>();

    filteredWords.forEach((word) => {
      const uniqueCharsInWord = new Set(word.split(''));
      uniqueCharsInWord.forEach((ch) => {
        candidateLetterCounts.set(ch, (candidateLetterCounts.get(ch) || 0) + 1);
      });
    });

    // Find letters that are NOT shared by ALL remaining words (distinguishing letters)
    const distinguishingLetterInfo: Array<{ char: string; count: number }> = [];

    candidateLetterCounts.forEach((count, char) => {
      if (count > 0 && count < filteredWords.length) {
        distinguishingLetters.add(char);
        distinguishingLetterInfo.push({ char, count });
      }
    });

    // Sort by count descending (most common distinguishing letters first)
    distinguishingLetterInfo.sort((a, b) => b.count - a.count || a.char.localeCompare(b.char));

    // Determine variable slot indices
    letterPositions.forEach((pos) => {
      const charsAtPos = new Set(filteredWords.map((w) => w[pos]));
      if (charsAtPos.size > 1) {
        variablePositions.push(pos);
      }
    });

    // 2. Search full word dictionary for optimal elimination words based on strategic pool reduction (information gain)
    const numCandidates = filteredWords.length;

    const scoredEliminationWords = words
      .map((w) => {
        const uniqueChars = new Set(w.split(''));
        let strategicScore = 0;
        let testedCount = 0;
        const testedCharsWithCounts: string[] = [];

        distinguishingLetterInfo.forEach(({ char, count }) => {
          if (uniqueChars.has(char)) {
            testedCount += 1;
            // Information theory partition efficiency: count * (numCandidates - count)
            // Letters present in ~50% of candidate words maximize entropy reduction
            const partitionEfficiency = count * (numCandidates - count);
            strategicScore += partitionEfficiency;
            testedCharsWithCounts.push(`${char} (x${count})`);
          }
        });

        const isCandidate = filteredWords.includes(w);

        return {
          word: w,
          score: testedCount,
          strategicScore,
          testedCharsWithCounts,
          isCandidate,
        };
      })
      .filter((item) => item.strategicScore > 0)
      .sort((a, b) => {
        // 1. Highest strategic expected pool reduction score
        if (b.strategicScore !== a.strategicScore) {
          return b.strategicScore - a.strategicScore;
        }
        // 2. Prefer words that are themselves possible candidate answers (direct win chance)
        if (b.isCandidate !== a.isCandidate) {
          return b.isCandidate ? 1 : -1;
        }
        // 3. Number of distinct distinguishing letters tested
        return b.score - a.score;
      });

    // Deduplicate & pick top 10 best elimination words
    const topEliminationWords = scoredEliminationWords.slice(0, 10);

    return {
      distinguishingLetterInfo,
      variablePositions,
      topEliminationWords,
    };
  }, [filteredWords, loading, words, wordLength]);

  // Loading screen while verifying admin authorization
  if (authLoading || (user && adminLoading)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mb-3" />
        <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500">Checking credentials...</span>
      </div>
    );
  }

  // If not admin: Throw a generic not found with weird html
  if (!isAdmin) {
    return (
      <div style={{ margin: 0, padding: '24px', backgroundColor: '#fff', color: '#222', fontFamily: 'Times New Roman, serif', minHeight: '100vh' }}>
        <h1 style={{ fontSize: '2em', fontWeight: 'bold', margin: '0 0 10px 0', borderBottom: '1px solid #000', paddingBottom: '4px' }}>
          404 Not Found
        </h1>
        <p style={{ fontSize: '14px', margin: '10px 0' }}>
          The requested URL <code style={{ fontFamily: 'Courier, monospace', color: '#900' }}>{typeof window !== 'undefined' ? window.location.pathname : '/word-finder-xyz'}</code> was not found on this server.
        </p>
        <p style={{ fontSize: '12px', color: '#555', marginTop: '20px' }}>
          <i>Additionally, a 404 Not Found error was encountered while trying to use an ErrorDocument to handle the request.</i>
        </p>
        <hr style={{ border: 'none', borderTop: '1px solid #aaa', margin: '20px 0' }} />
        <address style={{ fontSize: '11px', fontStyle: 'italic', color: '#666' }}>
          Apache/2.4.52 (Ubuntu) Server at {typeof window !== 'undefined' ? window.location.hostname : 'localhost'} Port 443
        </address>
        <div style={{ display: 'none' }}>
          <span>&lt;!-- [DEBUG: null_pointer_exception in route_handler.c:line_1049] --&gt;</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 sm:p-6 overflow-y-auto">
      {/* Dev Server Header Badge */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold"
          >
            <ArrowLeft size={16} /> Back to App
          </a>
          <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase rounded-lg tracking-wider">
            Dev Tool (Untracked)
          </span>
        </div>
        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          <RefreshCw size={14} /> Clear All
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-black tracking-wider uppercase text-white flex items-center justify-center gap-3">
          <span className="bg-amber-500 text-slate-950 px-3 py-1 rounded-xl">W</span> WORD FINDER
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">
          Unscramble letters, search by position & exclude words using official game wordlists
        </p>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-4xl space-y-6">
        {/* Global Controls: Length & List selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Word Length:</label>
            <select
              value={wordLength}
              onChange={(e) => setWordLength(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold text-amber-400 focus:outline-none focus:border-amber-500"
            >
              {[3, 4, 5, 6, 7, 8, 9, 10].map((len) => (
                <option key={len} value={len}>
                  {len}-Letter Words
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Word List:</label>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setListType('official')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${listType === 'official' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Official Answers
              </button>
              <button
                onClick={() => setListType('allowed')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${listType === 'allowed' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
              >
                All Allowed Words
              </button>
            </div>
          </div>
        </div>

        {/* Section 1: Standard Search (Starting, Ending, Containing, Anagram) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Search size={16} className="text-amber-400" />
            Quick Pattern Search
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={mode1Type}
              onChange={(e) => setMode1Type(e.target.value as 'starting' | 'ending' | 'containing' | 'exact_anagram')}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-amber-500 sm:w-48"
            >
              <option value="starting">Starting with</option>
              <option value="ending">Ending with</option>
              <option value="containing">Containing</option>
              <option value="exact_anagram">Unscramble letters</option>
            </select>
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Enter letters (e.g. TRA)..."
                value={mode1Letters}
                onChange={(e) => setMode1Letters(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-amber-400 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 tracking-wider"
              />
              {mode1Letters && (
                <button
                  onClick={() => setMode1Letters('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Fill-in-the-Blanks Search (Green & Yellow Grids) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Filter size={16} className="text-emerald-400" />
              Fill-in-the-Blanks Positional Search
            </div>
            <button
              onClick={() => {
                setSlots(Array(wordLength).fill(''));
                setYellowSlots(Array(wordLength).fill(''));
                setExcludeLetters('');
                setMustContainLetters('');
                setExcludeWordsInput('');
                ['wf_slots', 'wf_yellowSlots', 'wf_excludeLetters', 'wf_mustContainLetters', 'wf_excludeWordsInput'].forEach((k) => sessionStorage.removeItem(k));
              }}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-wider cursor-pointer"
            >
              Clear Grid
            </button>
          </div>

          {/* Green Slots Row */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              Green Row (Correct position):
            </label>
            <div className="flex flex-wrap justify-center gap-2">
              {slots.map((char, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength={1}
                  value={char}
                  placeholder={`${idx + 1}`}
                  onChange={(e) => handleSlotChange(idx, e.target.value)}
                  className="w-11 h-12 sm:w-14 sm:h-14 bg-slate-950 border-2 border-emerald-500/40 focus:border-emerald-400 text-center text-xl font-black uppercase text-emerald-400 placeholder:text-slate-700 placeholder:text-xs rounded-xl focus:outline-none transition-colors shadow-inner"
                />
              ))}
            </div>
          </div>

          {/* Yellow Slots Row */}
          <div className="space-y-2 pt-3 border-t border-slate-800/80">
            <label className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              Yellow Row (In word, but NOT in this position):
            </label>
            <div className="flex flex-wrap justify-center gap-2">
              {yellowSlots.map((chars, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength={5}
                  value={chars}
                  placeholder="🚫"
                  onChange={(e) => handleYellowSlotChange(idx, e.target.value)}
                  className="w-11 h-12 sm:w-14 sm:h-14 bg-slate-950 border-2 border-amber-500/40 focus:border-amber-400 text-center text-xs sm:text-sm font-black uppercase text-amber-400 placeholder:text-slate-700 placeholder:text-xs rounded-xl focus:outline-none transition-colors shadow-inner tracking-widest"
                  title={`Letters NOT at position ${idx + 1}, but present in word`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Section 3: Advanced Exclude & Must-Contain Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Filter size={16} className="text-rose-400" />
            Letter & Word Exclusions
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Exclude Letters (Gray letters):
              </label>
              <input
                type="text"
                placeholder="e.g. A, B, C or ABC..."
                value={excludeLetters}
                onChange={(e) => setExcludeLetters(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-rose-400 placeholder:text-slate-600 focus:outline-none focus:border-rose-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Must Contain Letters (Yellow letters):
              </label>
              <input
                type="text"
                placeholder="e.g. E, R or ER..."
                value={mustContainLetters}
                onChange={(e) => setMustContainLetters(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 uppercase"
              />
            </div>
          </div>

          {/* Exclude Specific Words Input */}
          <div>
            <label className="block text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-1.5">
              Exclude Specific Words (separated by spaces or commas):
            </label>
            <textarea
              rows={2}
              placeholder="e.g. CRANE STARE ADIEU AUDIO..."
              value={excludeWordsInput}
              onChange={(e) => setExcludeWordsInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm font-bold text-rose-300 placeholder:text-slate-600 focus:outline-none focus:border-rose-500 uppercase font-mono"
            />
            {excludedWordsSet.size > 0 && (
              <p className="text-[10px] text-rose-400 font-medium mt-1">
                Filtering out {excludedWordsSet.size} specific word{excludedWordsSet.size > 1 ? 's' : ''}.
              </p>
            )}
          </div>
        </div>

        {/* Unique Words Test / Optimal Elimination Words Section (< 45 words) */}
        {eliminationCandidates && eliminationCandidates.distinguishingLetterInfo.length > 0 && (
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">
                    Unique Words Test & Elimination Suggestions
                  </h3>
                  <p className="text-[11px] text-slate-400 font-bold">
                    Remaining possibilities are few ({filteredWords.length}). Use these words to eliminate multiple letters at once.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase rounded-lg">
                {eliminationCandidates.distinguishingLetterInfo.length} Key Letters to Test
              </span>
            </div>

            {/* Distinguishing Letters Pool with Word Counts eg C (x3) */}
            <div>
              <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                Distinguishing Letters to Test (frequency in remaining candidate words):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {eliminationCandidates.distinguishingLetterInfo.map(({ char, count }) => (
                  <span
                    key={char}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-black flex items-center justify-center text-xs shadow-sm gap-1"
                  >
                    <span>{char}</span>
                    <span className="text-[10px] text-amber-400/80 font-bold">(x{count})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Top Elimination Words Recommendations */}
            <div>
              <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                Best Elimination Words to Narrow Down Choices:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {eliminationCandidates.topEliminationWords.map((item) => (
                  <div
                    key={item.word}
                    className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl p-2.5 flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-white tracking-widest">{item.word}</span>
                      {item.isCandidate && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                          POSSIBLE ANSWER
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-400">Tests ({item.score}):</span>
                      <span className="text-xs font-black text-amber-300 tracking-wider">
                        {item.testedCharsWithCounts.join(', ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-white">Matching Words</span>
              <span className="bg-amber-500/20 text-amber-400 text-xs font-black px-2.5 py-0.5 rounded-full border border-amber-500/30">
                {filteredWords.length}
              </span>
            </div>
            {loading && <span className="text-xs text-amber-400 animate-pulse font-bold">Loading dictionary...</span>}
          </div>

          {!loading && filteredWords.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm font-medium">
              No matching words found for your current criteria.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {filteredWords.map((word) => (
                <div
                  key={word}
                  className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/50 rounded-xl px-3 py-2 text-center text-sm font-black tracking-widest text-slate-200 transition-all font-mono select-all cursor-pointer"
                  title="Click or double-click to select word"
                >
                  {word}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
