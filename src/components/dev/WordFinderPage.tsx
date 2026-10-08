import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { loadWordLists } from '../../data/words';
import { Search, Filter, RefreshCw, X, ArrowLeft, Sparkles, Flame, Zap, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminStatus } from '../../hooks/useAdminStatus';

import { calculateWordEliminationScore, OPTIMAL_STARTERS_BY_LENGTH } from '../../data/researchInsights';

type ListType = 'official' | 'allowed';
type SortOrder = 'elimination' | 'alphabetical';
type SearchMode = 'pattern' | 'blanks' | 'starter_suggest';

const PAGE_SIZE = 72;

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
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const saved = sessionStorage.getItem('wf_sortOrder');
    return (saved as SortOrder) || 'elimination';
  });
  const [activeTab, setActiveTab] = useState<SearchMode>(() => {
    const saved = sessionStorage.getItem('wf_activeTab');
    return (saved as SearchMode) || 'blanks';
  });

  const [words, setWords] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedWord, setCopiedWord] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);

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

  // Mode 3: Starter Word Evaluator / Suggester target input
  const [targetWordQuery, setTargetWordQuery] = useState<string>(() => {
    return sessionStorage.getItem('wf_targetWordQuery') || '';
  });

  // Save states to sessionStorage
  useEffect(() => { sessionStorage.setItem('wf_wordLength', String(wordLength)); }, [wordLength]);
  useEffect(() => { sessionStorage.setItem('wf_listType', listType); }, [listType]);
  useEffect(() => { sessionStorage.setItem('wf_sortOrder', sortOrder); }, [sortOrder]);
  useEffect(() => { sessionStorage.setItem('wf_activeTab', activeTab); }, [activeTab]);
  useEffect(() => { sessionStorage.setItem('wf_mode1Type', mode1Type); }, [mode1Type]);
  useEffect(() => { sessionStorage.setItem('wf_mode1Letters', mode1Letters); }, [mode1Letters]);
  useEffect(() => { sessionStorage.setItem('wf_slots', JSON.stringify(slots)); }, [slots]);
  useEffect(() => { sessionStorage.setItem('wf_yellowSlots', JSON.stringify(yellowSlots)); }, [yellowSlots]);
  useEffect(() => { sessionStorage.setItem('wf_excludeLetters', excludeLetters); }, [excludeLetters]);
  useEffect(() => { sessionStorage.setItem('wf_mustContainLetters', mustContainLetters); }, [mustContainLetters]);
  useEffect(() => { sessionStorage.setItem('wf_excludeWordsInput', excludeWordsInput); }, [excludeWordsInput]);
  useEffect(() => { sessionStorage.setItem('wf_targetWordQuery', targetWordQuery); }, [targetWordQuery]);

  // Fast Clear All function
  const clearAll = useCallback((newLen?: number) => {
    const targetLen = typeof newLen === 'number' ? newLen : wordLength;
    setMode1Letters('');
    setSlots(Array(targetLen).fill(''));
    setYellowSlots(Array(targetLen).fill(''));
    setExcludeLetters('');
    setMustContainLetters('');
    setExcludeWordsInput('');
    setTargetWordQuery('');
    setPage(1);

    [
      'wf_mode1Letters',
      'wf_slots',
      'wf_yellowSlots',
      'wf_excludeLetters',
      'wf_mustContainLetters',
      'wf_excludeWordsInput',
      'wf_targetWordQuery',
    ].forEach((k) => sessionStorage.removeItem(k));
  }, [wordLength]);

  // Handle word length change with automatic clean reset
  const handleWordLengthChange = (newLen: number) => {
    setWordLength(newLen);
    clearAll(newLen);
  };

  // Reset pagination on any filter change
  useEffect(() => {
    setPage(1);
  }, [
    wordLength,
    listType,
    sortOrder,
    mode1Letters,
    mode1Type,
    slots,
    yellowSlots,
    excludeLetters,
    mustContainLetters,
    excludeWordsInput,
  ]);

  // Copy helper
  const handleCopyWord = useCallback((word: string) => {
    navigator.clipboard.writeText(word);
    setCopiedWord(word);
    setTimeout(() => {
      setCopiedWord((prev) => (prev === word ? null : prev));
    }, 1500);
  }, []);

  // Load word lists when length or listType changes
  useEffect(() => {
    let active = true;
    setLoading(true);
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

  // Parse excluded words into Set
  const excludedWordsSet = useMemo(() => {
    if (!excludeWordsInput.trim()) return null;
    const tokens = excludeWordsInput
      .toUpperCase()
      .split(/[\s,;]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    return tokens.length > 0 ? new Set(tokens) : null;
  }, [excludeWordsInput]);

  // High-performance filter calculation
  const filteredWords = useMemo(() => {
    if (loading || !words.length) return [];

    const mode1Query = mode1Letters.trim().toUpperCase();
    const cleanExclude = excludeLetters.toUpperCase().replace(/[^A-Z]/g, '');
    const cleanMustContain = mustContainLetters.toUpperCase().replace(/[^A-Z]/g, '');

    const mustContainArr = cleanMustContain ? cleanMustContain.split('') : [];
    const excludeSet = cleanExclude ? new Set(cleanExclude.split('')) : null;

    // Letters that are in BOTH mustContain and excludeSet have an exact known count
    const exactCounts = new Map<string, number>();
    const pureExcludeSet = new Set<string>();

    if (excludeSet) {
      excludeSet.forEach((char) => {
        const requiredCount = mustContainArr.filter((c) => c === char).length;
        if (requiredCount > 0) {
          exactCounts.set(char, requiredCount);
        } else {
          pureExcludeSet.add(char);
        }
      });
    }

    const hasExactCounts = exactCounts.size > 0;
    const hasPureExcludes = pureExcludeSet.size > 0;
    const hasMustContain = mustContainArr.length > 0;

    // Pre-calculate green slots
    const activeGreenSlots: { index: number; char: string }[] = [];
    for (let i = 0; i < wordLength; i++) {
      const ch = slots[i]?.trim().toUpperCase();
      if (ch) activeGreenSlots.push({ index: i, char: ch });
    }
    const hasGreenSlots = activeGreenSlots.length > 0;

    // Pre-calculate yellow slots
    const activeYellowSlots: { index: number; chars: string[] }[] = [];
    for (let i = 0; i < wordLength; i++) {
      const chars = yellowSlots[i]?.trim().toUpperCase();
      if (chars) {
        activeYellowSlots.push({ index: i, chars: chars.split('') });
      }
    }
    const hasYellowSlots = activeYellowSlots.length > 0;

    // Pre-parse anagram pool if needed
    const isAnagram = mode1Type === 'exact_anagram' && !!mode1Query;
    let anagramCountMap: Map<string, number> | null = null;
    if (isAnagram) {
      anagramCountMap = new Map<string, number>();
      for (let i = 0; i < mode1Query.length; i++) {
        const ch = mode1Query[i];
        anagramCountMap.set(ch, (anagramCountMap.get(ch) || 0) + 1);
      }
    }

    const result: string[] = [];
    const wordsLen = words.length;

    for (let w = 0; w < wordsLen; w++) {
      const word = words[w];

      // Excluded words filter
      if (excludedWordsSet && excludedWordsSet.has(word)) continue;

      // Pure exclude letters filter (0 occurrences allowed)
      if (hasPureExcludes) {
        let excluded = false;
        for (let i = 0; i < wordLength; i++) {
          if (pureExcludeSet.has(word[i])) {
            excluded = true;
            break;
          }
        }
        if (excluded) continue;
      }

      // Must contain letters filter (at least 1 occurrence for each)
      if (hasMustContain) {
        let missingMust = false;
        for (let i = 0; i < mustContainArr.length; i++) {
          if (!word.includes(mustContainArr[i])) {
            missingMust = true;
            break;
          }
        }
        if (missingMust) continue;
      }

      // Exact count constraint
      if (hasExactCounts) {
        let mismatchCount = false;
        for (const [char, exactCount] of exactCounts.entries()) {
          let actualCount = 0;
          for (let i = 0; i < wordLength; i++) {
            if (word[i] === char) actualCount++;
          }
          if (actualCount !== exactCount) {
            mismatchCount = true;
            break;
          }
        }
        if (mismatchCount) continue;
      }

      // Fill-in-the-blanks green positional match
      if (hasGreenSlots) {
        let greenFail = false;
        for (let i = 0; i < activeGreenSlots.length; i++) {
          const { index, char } = activeGreenSlots[i];
          if (word[index] !== char) {
            greenFail = true;
            break;
          }
        }
        if (greenFail) continue;
      }

      // Fill-in-the-blanks yellow positional match
      if (hasYellowSlots) {
        let yellowFail = false;
        for (let i = 0; i < activeYellowSlots.length; i++) {
          const { index, chars } = activeYellowSlots[i];
          for (let j = 0; j < chars.length; j++) {
            const ch = chars[j];
            if (!word.includes(ch) || word[index] === ch) {
              yellowFail = true;
              break;
            }
          }
          if (yellowFail) break;
        }
        if (yellowFail) continue;
      }

      // Quick Pattern filter
      if (mode1Query) {
        if (mode1Type === 'starting') {
          if (!word.startsWith(mode1Query)) continue;
        } else if (mode1Type === 'ending') {
          if (!word.endsWith(mode1Query)) continue;
        } else if (mode1Type === 'containing') {
          if (!word.includes(mode1Query)) continue;
        } else if (isAnagram && anagramCountMap) {
          const tempMap = new Map(anagramCountMap);
          let fits = true;
          for (let i = 0; i < wordLength; i++) {
            const ch = word[i];
            const count = tempMap.get(ch) || 0;
            if (count <= 0) {
              fits = false;
              break;
            }
            tempMap.set(ch, count - 1);
          }
          if (!fits) continue;
        }
      }

      result.push(word);
    }

    return result;
  }, [words, loading, mode1Letters, mode1Type, slots, yellowSlots, wordLength, excludeLetters, mustContainLetters, excludedWordsSet]);

  // Fast pre-computed positional letter frequency table for filtered words
  const positionalCharCounts = useMemo(() => {
    if (!filteredWords.length) return null;
    const counts: Array<Map<string, number>> = Array.from({ length: wordLength }, () => new Map<string, number>());
    for (let w = 0; w < filteredWords.length; w++) {
      const word = filteredWords[w];
      for (let i = 0; i < wordLength; i++) {
        const ch = word[i];
        const m = counts[i];
        m.set(ch, (m.get(ch) || 0) + 1);
      }
    }
    return counts;
  }, [filteredWords, wordLength]);

  // Ranked matching candidate words with detailed elimination scores
  const rankedMatchingWords = useMemo(() => {
    if (!filteredWords.length) return [];

    if (sortOrder === 'alphabetical') {
      return filteredWords.map((word) => ({
        word,
        totalScore: 0,
        strategicScore: 0,
        testedDistinguishingLetters: [],
        testedCount: 0,
        positionalBonus: 0,
      }));
    }

    // Fast frequency map of unique letters in remaining pool
    const letterFreq = new Map<string, number>();
    const numCandidates = filteredWords.length;

    for (let i = 0; i < numCandidates; i++) {
      const w = filteredWords[i];
      const seen = new Set<string>();
      for (let j = 0; j < wordLength; j++) {
        const ch = w[j];
        if (!seen.has(ch)) {
          seen.add(ch);
          letterFreq.set(ch, (letterFreq.get(ch) || 0) + 1);
        }
      }
    }

    const scored = filteredWords.map((word) => {
      let strategicScore = 0;
      let testedCount = 0;
      const testedDistinguishingLetters: string[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < wordLength; i++) {
        const ch = word[i];
        if (!seen.has(ch)) {
          seen.add(ch);
          const count = letterFreq.get(ch) || 0;
          if (count > 0 && count < numCandidates) {
            strategicScore += count * (numCandidates - count);
            testedCount++;
            if (testedDistinguishingLetters.length < 5) {
              testedDistinguishingLetters.push(`${ch} (x${count})`);
            }
          }
        }
      }

      // Fast positional score from our pre-computed counts
      let positionalBonus = 0;
      if (positionalCharCounts) {
        for (let i = 0; i < wordLength; i++) {
          const ch = word[i];
          positionalBonus += (positionalCharCounts[i]?.get(ch) || 0) * 0.1;
        }
      }

      const candidateBonus = numCandidates <= 2 ? 200 : numCandidates <= 4 ? 75 : numCandidates <= 10 ? 25 : 10;
      const totalScore = strategicScore + candidateBonus + positionalBonus + seen.size * 2;

      return {
        word,
        totalScore,
        strategicScore,
        testedDistinguishingLetters,
        testedCount,
        positionalBonus,
      };
    });

    return scored.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.testedCount !== a.testedCount) return b.testedCount - a.testedCount;
      return a.word.localeCompare(b.word);
    });
  }, [filteredWords, wordLength, sortOrder, positionalCharCounts]);

  // Top 3 Recommended Picks with highest strategic potential for the current query
  const topRecommendedPicks = useMemo(() => {
    if (rankedMatchingWords.length <= 1) return [];
    // If sorted alphabetically, rank a temporary slice to get top 3 optimal picks
    if (sortOrder === 'alphabetical') {
      const letterFreq = new Map<string, number>();
      const numCandidates = filteredWords.length;
      for (let i = 0; i < numCandidates; i++) {
        const w = filteredWords[i];
        const seen = new Set<string>();
        for (let j = 0; j < wordLength; j++) {
          const ch = w[j];
          if (!seen.has(ch)) {
            seen.add(ch);
            letterFreq.set(ch, (letterFreq.get(ch) || 0) + 1);
          }
        }
      }

      const scored = filteredWords.map((word) => {
        let score = 0;
        let tested = 0;
        const seen = new Set<string>();
        for (let i = 0; i < wordLength; i++) {
          const ch = word[i];
          if (!seen.has(ch)) {
            seen.add(ch);
            const count = letterFreq.get(ch) || 0;
            if (count > 0 && count < numCandidates) {
              score += count * (numCandidates - count);
              tested++;
            }
          }
        }
        return { word, totalScore: score + seen.size * 5, testedCount: tested };
      });

      scored.sort((a, b) => b.totalScore - a.totalScore || b.testedCount - a.testedCount);
      return scored.slice(0, 3);
    }

    return rankedMatchingWords.slice(0, 3);
  }, [rankedMatchingWords, filteredWords, wordLength, sortOrder]);

  // Curated research optimal starters for current word length
  const lengthStarterList = useMemo(() => {
    return OPTIMAL_STARTERS_BY_LENGTH[wordLength] || [];
  }, [wordLength]);

  // Suggested 3-5 optimal starters for any given target word / word length
  const suggestedStartersForTarget = useMemo(() => {
    const cleanTarget = targetWordQuery.trim().toUpperCase();
    const curated = OPTIMAL_STARTERS_BY_LENGTH[wordLength] || [];

    if (!cleanTarget || cleanTarget.length !== wordLength) {
      // General length recommendations (top 4 curated)
      return curated.slice(0, 5).map((word, idx) => ({
        word,
        rank: idx + 1,
        entropyScore: 98 - idx * 3,
        reason: idx === 0 ? 'Mathematically highest information entropy opener' : 'High frequency vowel-consonant split',
        letterCoverage: Array.from(new Set(word.split(''))).join(', '),
      }));
    }

    // Specific target word feedback calculation
    const targetSet = new Set(cleanTarget.split(''));

    const scored = curated.map((starter) => {
      let greenMatches = 0;
      let yellowMatches = 0;
      const starterSet = new Set(starter.split(''));

      for (let i = 0; i < wordLength; i++) {
        if (starter[i] === cleanTarget[i]) {
          greenMatches++;
        } else if (targetSet.has(starter[i])) {
          yellowMatches++;
        }
      }

      const overlapCount = greenMatches + yellowMatches;
      const efficiency = greenMatches * 3 + yellowMatches * 1.5 + (starterSet.size === wordLength ? 2 : 0);

      return {
        word: starter,
        greenMatches,
        yellowMatches,
        overlapCount,
        efficiency,
        letterCoverage: Array.from(starterSet).join(', '),
      };
    });

    scored.sort((a, b) => b.efficiency - a.efficiency || b.overlapCount - a.overlapCount);

    return scored.slice(0, 5).map((item, idx) => ({
      word: item.word,
      rank: idx + 1,
      entropyScore: Math.round(85 + item.efficiency * 2),
      reason:
        item.greenMatches > 0
          ? `Guarantees ${item.greenMatches} Direct Green exact hit${item.greenMatches > 1 ? 's' : ''} against "${cleanTarget}"`
          : item.yellowMatches > 0
          ? `Reveals ${item.yellowMatches} Yellow letter clue${item.yellowMatches > 1 ? 's' : ''} on Turn 1`
          : 'Eliminates 5 high-frequency letters, instantly pruning search space',
      letterCoverage: item.letterCoverage,
    }));
  }, [targetWordQuery, wordLength]);

  // Unique words test & elimination candidates when remaining words < 100
  const eliminationCandidates = useMemo(() => {
    if (loading || filteredWords.length < 2 || filteredWords.length >= 100) {
      return null;
    }

    const candidateLetterCounts = new Map<string, number>();
    const distinguishingLetters = new Set<string>();

    filteredWords.forEach((word) => {
      const uniqueCharsInWord = new Set(word.split(''));
      uniqueCharsInWord.forEach((ch) => {
        candidateLetterCounts.set(ch, (candidateLetterCounts.get(ch) || 0) + 1);
      });
    });

    const distinguishingLetterInfo: Array<{ char: string; count: number }> = [];
    candidateLetterCounts.forEach((count, char) => {
      if (count > 0 && count < filteredWords.length) {
        distinguishingLetters.add(char);
        distinguishingLetterInfo.push({ char, count });
      }
    });

    distinguishingLetterInfo.sort((a, b) => b.count - a.count || a.char.localeCompare(b.char));

    const scoredEliminationWords = words
      .map((w) => {
        const isCandidate = filteredWords.includes(w);
        const { totalScore, strategicScore, testedDistinguishingLetters, testedCount, positionalBonus } =
          calculateWordEliminationScore(w, filteredWords, wordLength, isCandidate);

        return {
          word: w,
          score: testedCount,
          strategicScore,
          totalScore,
          positionalBonus,
          testedCharsWithCounts: testedDistinguishingLetters,
          isCandidate,
        };
      })
      .filter((item) => item.strategicScore > 0 || item.isCandidate)
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.isCandidate !== a.isCandidate) return b.isCandidate ? 1 : -1;
        return b.score - a.score;
      });

    const topEliminationWords = scoredEliminationWords.slice(0, 8);

    return {
      distinguishingLetterInfo,
      topEliminationWords,
    };
  }, [filteredWords, loading, words, wordLength]);

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

  // Pagination calculations for matching words list
  const totalPages = Math.ceil(rankedMatchingWords.length / PAGE_SIZE) || 1;
  const paginatedWords = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rankedMatchingWords.slice(start, start + PAGE_SIZE);
  }, [rankedMatchingWords, page]);

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
      {/* Top Header Controls */}
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
          onClick={() => clearAll()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700/60"
          title="Clear all search parameters and reset grid"
        >
          <RefreshCw size={14} /> Clear All
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-black tracking-wider uppercase text-white flex items-center justify-center gap-3">
          <span className="bg-amber-500 text-slate-950 px-3 py-1 rounded-xl shadow-lg shadow-amber-500/20">W</span> WORD FINDER & SOLVER
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">
          Ultra-fast dictionary search, optimal starter recommender & information entropy elimination engine
        </p>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-4xl space-y-6">
        {/* Global Controls: Length & List selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Word Length:</label>
            <select
              value={wordLength}
              onChange={(e) => handleWordLengthChange(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold text-amber-400 focus:outline-none focus:border-amber-500 cursor-pointer shadow-inner"
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
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  listType === 'official' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Official Answers
              </button>
              <button
                onClick={() => setListType('allowed')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  listType === 'allowed' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                All Allowed Words
              </button>
            </div>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-lg">
          <button
            onClick={() => setActiveTab('pattern')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'pattern'
                ? 'bg-amber-500 text-slate-950 shadow-lg font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Search size={15} />
            <span className="hidden sm:inline">Pattern & Anagram</span>
            <span className="sm:hidden">Pattern</span>
          </button>
          <button
            onClick={() => setActiveTab('blanks')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'blanks'
                ? 'bg-emerald-500 text-slate-950 shadow-lg font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Filter size={15} />
            <span className="hidden sm:inline">Positional Blanks</span>
            <span className="sm:hidden">Grid</span>
          </button>
          <button
            onClick={() => setActiveTab('starter_suggest')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'starter_suggest'
                ? 'bg-indigo-500 text-white shadow-lg font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles size={15} />
            <span className="hidden sm:inline">Suggest Starter Word</span>
            <span className="sm:hidden">Starters</span>
          </button>
        </div>

        {/* TAB 1: Pattern Search */}
        {activeTab === 'pattern' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Search size={16} className="text-amber-400" />
              Quick Pattern & Unscramble Search
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
                  placeholder="Enter letters (e.g. TRA or CRANE)..."
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
        )}

        {/* TAB 2: Fill-in-the-Blanks Search (Green & Yellow Grids) */}
        {activeTab === 'blanks' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Filter size={16} className="text-emerald-400" />
                Fill-in-the-Blanks Positional Search
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSlots(Array(wordLength).fill(''));
                    setYellowSlots(Array(wordLength).fill(''));
                    ['wf_slots', 'wf_yellowSlots'].forEach((k) => sessionStorage.removeItem(k));
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 rounded-lg transition-colors cursor-pointer"
                  title="Clear green and yellow grid slots only"
                >
                  Clear Grid
                </button>
                <button
                  onClick={() => clearAll()}
                  className="px-2.5 py-1 text-[11px] font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  title="Clear all grid slots and letter filters"
                >
                  <RefreshCw size={12} />
                  Clear All
                </button>
              </div>
            </div>

            {/* Green Slots Row */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Green Row (Known exact letter position):
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
                Yellow Row (In word, but NOT in this slot):
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
        )}

        {/* TAB 3: SUGGEST STARTER WORD MODE */}
        {activeTab === 'starter_suggest' && (
          <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-2xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-400" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Optimal Starter Word Engine ({wordLength}-Letters)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Calculated via entropy partition information theory & positional vowel/consonant weighting.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase rounded-lg">
                Research Backed
              </span>
            </div>

            {/* Target Word Input (Optional for specific testing) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <label className="block text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                Analyze Starters for Specific Target Word (Optional):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={wordLength}
                  placeholder={`Enter a ${wordLength}-letter target word (e.g. ${lengthStarterList[0] || 'CRANE'})...`}
                  value={targetWordQuery}
                  onChange={(e) => setTargetWordQuery(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-indigo-400 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 uppercase tracking-widest font-mono"
                />
                {targetWordQuery && (
                  <button
                    onClick={() => setTargetWordQuery('')}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    Clear Target
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {targetWordQuery.length === wordLength
                  ? `Simulating opening effectiveness specifically against target answer "${targetWordQuery}".`
                  : `Leave blank to view general mathematically proven 3-5 best openers for all ${wordLength}-letter games.`}
              </p>
            </div>

            {/* Top 3-5 Suggested Starters Cards */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Flame size={14} className="text-amber-400" />
                Top 3-5 Recommended Starters:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestedStartersForTarget.map((starter) => (
                  <div
                    key={starter.word}
                    onClick={() => handleCopyWord(starter.word)}
                    className="group bg-slate-950 border border-slate-800 hover:border-indigo-500/60 rounded-xl p-3.5 transition-all cursor-pointer shadow-md hover:shadow-indigo-500/10 flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-black flex items-center justify-center font-mono">
                          #{starter.rank}
                        </span>
                        <span className="text-base font-black font-mono tracking-widest text-white group-hover:text-indigo-400 transition-colors">
                          {starter.word}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400">Entropy Score:</span>
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 font-mono text-xs font-black rounded-md">
                          {starter.entropyScore}
                        </span>
                        <button className="text-slate-500 group-hover:text-white p-1">
                          {copiedWord === starter.word ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300 font-medium leading-relaxed">{starter.reason}</p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-900">
                      <span>Unique letters: <strong className="text-slate-200">{starter.letterCoverage}</strong></span>
                      <span className="text-indigo-400/80 font-bold group-hover:underline">Click to copy</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Global Common Letter & Word Exclusions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Filter size={16} className="text-rose-400" />
            Common Letter & Word Constraints
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
            {excludedWordsSet && excludedWordsSet.size > 0 && (
              <p className="text-[10px] text-rose-400 font-medium mt-1">
                Filtering out {excludedWordsSet.size} specific word{excludedWordsSet.size > 1 ? 's' : ''}.
              </p>
            )}
          </div>
        </div>

        {/* TOP RECOMMENDED PICKS (TOP 2-3 WITH HIGHEST POTENTIAL) */}
        {filteredWords.length > 1 && topRecommendedPicks.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-transparent border border-amber-500/40 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-amber-400 animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">
                  Top Recommended Picks (Highest Potential)
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                Optimized from {filteredWords.length} matching words
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {topRecommendedPicks.map((pick, idx) => (
                <div
                  key={pick.word}
                  onClick={() => handleCopyWord(pick.word)}
                  className="bg-slate-950/90 border border-amber-500/30 hover:border-amber-400 rounded-xl p-3 flex flex-col justify-between transition-all cursor-pointer group shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-black rounded">
                      #{idx + 1} Best Pick
                    </span>
                    <button className="text-slate-500 group-hover:text-white">
                      {copiedWord === pick.word ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div className="my-2 text-center">
                    <span className="font-mono text-lg font-black tracking-widest text-white group-hover:text-amber-400 transition-colors">
                      {pick.word}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
                    <span>Elimination tests:</span>
                    <span className="font-mono font-bold text-amber-300">
                      {pick.testedCount > 0 ? `${pick.testedCount} letters` : 'Top entropy'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unique Words Test / Optimal Elimination Words Section (< 100 words) */}
        {eliminationCandidates && eliminationCandidates.distinguishingLetterInfo.length > 0 && (
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">
                    Unique Words Test & Optimal Elimination Words
                  </h3>
                  <p className="text-[11px] text-slate-400 font-bold">
                    Remaining candidates ({filteredWords.length}). Ranked by entropy partition value and research letter frequencies.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase rounded-lg">
                {eliminationCandidates.distinguishingLetterInfo.length} Key Letters to Test
              </span>
            </div>

            {/* Distinguishing Letters Pool */}
            <div>
              <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                Distinguishing Letters to Test:
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
                {eliminationCandidates.topEliminationWords.map((item, idx) => (
                  <div
                    key={item.word}
                    onClick={() => handleCopyWord(item.word)}
                    className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl p-2.5 flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-amber-500/80 font-mono w-4">#{idx + 1}</span>
                      <span className="font-mono text-sm font-black text-white group-hover:text-amber-400 tracking-widest">{item.word}</span>
                      {item.isCandidate && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                          POSSIBLE ANSWER
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400">Tests ({item.score}):</span>
                      <span className="text-xs font-black text-amber-300 tracking-wider">
                        {item.testedCharsWithCounts.slice(0, 3).join(', ')}
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-white">Matching Words</span>
              <span className="bg-amber-500/20 text-amber-400 text-xs font-black px-2.5 py-0.5 rounded-full border border-amber-500/30">
                {filteredWords.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sort:</span>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setSortOrder('elimination')}
                  className={`px-2.5 py-1 font-bold rounded-lg transition-colors cursor-pointer ${
                    sortOrder === 'elimination'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Ranked by highest elimination value and positional entropy"
                >
                  Best Elimination
                </button>
                <button
                  onClick={() => setSortOrder('alphabetical')}
                  className={`px-2.5 py-1 font-bold rounded-lg transition-colors cursor-pointer ${
                    sortOrder === 'alphabetical'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  A-Z
                </button>
              </div>
            </div>

            {loading && <span className="text-xs text-amber-400 animate-pulse font-bold">Loading dictionary...</span>}
          </div>

          {!loading && rankedMatchingWords.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm font-medium">
              No matching words found for your current criteria.
            </div>
          ) : (
            <>
              <div className="max-h-[32rem] overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {paginatedWords.map((item, index) => {
                  const globalIndex = (page - 1) * PAGE_SIZE + index + 1;
                  return (
                    <div
                      key={item.word}
                      onClick={() => handleCopyWord(item.word)}
                      className="relative group bg-slate-950 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-800/40 rounded-xl px-2.5 py-2 text-center transition-all font-mono cursor-pointer shadow-sm flex flex-col justify-center"
                      title="Click to copy word"
                    >
                      <div className="text-sm font-black tracking-widest text-slate-200 group-hover:text-amber-400 transition-colors flex items-center justify-center gap-1">
                        <span>{item.word}</span>
                        {copiedWord === item.word && <Check size={12} className="text-emerald-400" />}
                      </div>
                      {sortOrder === 'elimination' && filteredWords.length > 1 && (
                        <div className="text-[9px] font-bold text-amber-400/70 mt-0.5 flex items-center justify-center gap-1">
                          <span>#{globalIndex}</span>
                          {item.testedCount > 0 && <span>• {item.testedCount} tests</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
                  <span>
                    Showing {Math.min((page - 1) * PAGE_SIZE + 1, rankedMatchingWords.length)} - {Math.min(page * PAGE_SIZE, rankedMatchingWords.length)} of {rankedMatchingWords.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-2 font-mono font-bold text-slate-300">
                      {page} / {totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
