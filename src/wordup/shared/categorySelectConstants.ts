/* eslint-disable @typescript-eslint/no-explicit-any */
import { safeLocalStorage } from "../../utils/storage";

export const RECENTS_KEY = "wordup_recent_categories";
export const MAX_RECENTS = 5;

export function loadRecents(): string[] {
   try {
      const raw = safeLocalStorage.getItem(RECENTS_KEY);
      return raw ? JSON.parse(raw) : [];
   } catch {
      return [];
   }
}

export function saveRecents(ids: string[]) {
   try {
      safeLocalStorage.setItem(RECENTS_KEY, JSON.stringify(ids));
   } catch { /* ignore */ }
}

export function pushRecent(ids: string[], id: string): string[] {
   const filtered = ids.filter((i) => i !== id);
   return [id, ...filtered].slice(0, MAX_RECENTS);
}

export const CATEGORY_STYLE_MAP: Record<string, { emoji: string; gradient: string; glow: string; border: string; svg?: string }> = {
   mixed: {
      emoji: "🎲",
      gradient: "from-emerald-950/40 via-emerald-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
      border: "border-emerald-500/50 text-emerald-400",
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>`
   },
   maths: {
      emoji: "🧮",
      gradient: "from-orange-950/40 via-orange-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(249,115,22,0.15)]",
      border: "border-orange-500/50 text-orange-400",
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="17" x2="15" y2="17"/></svg>`
   },
   english_language: {
      emoji: "📚",
      gradient: "from-blue-950/40 via-blue-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]",
      border: "border-blue-500/50 text-blue-400"
   },
   english_fundamentals: {
      emoji: "📖",
      gradient: "from-teal-950/40 via-teal-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(20,184,166,0.15)]",
      border: "border-teal-500/50 text-teal-400"
   },
   vowel_drop: {
      emoji: "🅰️",
      gradient: "from-red-950/40 via-red-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]",
      border: "border-red-500/50 text-red-400"
   },
   anagram_scrambled: {
      emoji: "🔀",
      gradient: "from-orange-950/40 via-orange-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(249,115,22,0.15)]",
      border: "border-orange-500/50 text-orange-400"
   },
   reverse_wordle: {
      emoji: "🔄",
      gradient: "from-yellow-950/40 via-yellow-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(234,179,8,0.15)]",
      border: "border-yellow-500/50 text-yellow-400"
   },
   missing_letter: {
      emoji: "🧩",
      gradient: "from-green-950/40 via-green-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(34,197,94,0.15)]",
      border: "border-green-500/50 text-green-400"
   },
   word_ladder: {
      emoji: "🪜",
      gradient: "from-teal-950/40 via-teal-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(20,184,166,0.15)]",
      border: "border-teal-500/50 text-teal-400"
   },
   rhyme_match: {
      emoji: "🎵",
      gradient: "from-sky-950/40 via-sky-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(14,165,233,0.15)]",
      border: "border-sky-500/50 text-sky-400"
   },
   letter_count: {
      emoji: "🔢",
      gradient: "from-blue-950/40 via-blue-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]",
      border: "border-blue-500/50 text-blue-400"
   },
   capitals_clash: {
      emoji: "🌍",
      gradient: "from-indigo-950/40 via-indigo-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(99,102,241,0.15)]",
      border: "border-indigo-500/50 text-indigo-400"
   },
   currency_exchange: {
      emoji: "💸",
      gradient: "from-purple-950/40 via-purple-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   flag_bearer: {
      emoji: "🚩",
      gradient: "from-fuchsia-950/40 via-fuchsia-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(217,70,239,0.15)]",
      border: "border-fuchsia-500/50 text-fuchsia-400",
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`
   },
   mental_math_blitz: {
      emoji: "🧮",
      gradient: "from-pink-950/40 via-pink-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(236,72,153,0.15)]",
      border: "border-pink-500/50 text-pink-400"
   },
   sequence_solver: {
      emoji: "📈",
      gradient: "from-rose-950/40 via-rose-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(244,63,94,0.15)]",
      border: "border-rose-500/50 text-rose-400"
   },
   element_arena: {
      emoji: "🧪",
      gradient: "from-emerald-950/40 via-emerald-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
      border: "border-emerald-500/50 text-emerald-400"
   },
   animal_kingdom: {
      emoji: "🦁",
      gradient: "from-amber-950/40 via-amber-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]",
      border: "border-amber-500/50 text-amber-400"
   },
   cosmic_frontier: {
      emoji: "🚀",
      gradient: "from-cyan-950/40 via-cyan-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   cinephile_trivia: {
      emoji: "🎬",
      gradient: "from-violet-950/40 via-violet-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(139,92,246,0.15)]",
      border: "border-violet-500/50 text-violet-400"
   },
   history_milestones: {
      emoji: "🏛️",
      gradient: "from-lime-950/40 via-lime-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(132,204,22,0.15)]",
      border: "border-lime-500/50 text-lime-400"
   },
   naija_music: {
      emoji: "🎧",
      gradient: "from-pink-950/40 via-purple-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(236,72,153,0.15)]",
      border: "border-pink-500/50 text-pink-400"
   },
   naija_celebs: {
      emoji: "🇳🇬",
      gradient: "from-green-950/40 via-emerald-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(34,197,94,0.15)]",
      border: "border-green-500/50 text-green-400"
   },
   unn_lions: {
      emoji: "🦁",
      gradient: "from-red-950/40 via-rose-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]",
      border: "border-red-500/50 text-red-400"
   },
   nysc_trivia: {
      emoji: "🪖",
      gradient: "from-yellow-950/40 via-lime-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(132,204,22,0.15)]",
      border: "border-lime-500/50 text-lime-400"
   },
   us_tech_trivia: {
      emoji: "💻",
      gradient: "from-blue-950/40 via-sky-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(59,130,246,0.15)]",
      border: "border-blue-500/50 text-blue-400"
   },
   elon_musk: {
      emoji: "🚘",
      gradient: "from-purple-950/40 via-indigo-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   chemistry: {
      emoji: "🧪",
      gradient: "from-emerald-950/40 via-emerald-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
      border: "border-emerald-500/50 text-emerald-400"
   },
   football: {
      emoji: "⚽",
      gradient: "from-green-950/40 via-green-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(34,197,94,0.15)]",
      border: "border-green-500/50 text-green-400",
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m12 2-2 3.5 2.5 2h3L17.5 4z"/><path d="M12 22v-4.5l-2.5-2h-3L4.5 18z"/><path d="M2 12h4.5l2-2.5v-3L5 5z"/><path d="M22 12h-4.5l-2 2.5v3l3.5 1.5z"/><path d="m9.5 7.5 2.5 2 2.5-2v-3h-5z"/><path d="m9.5 16.5 2.5-2 2.5 2v3h-5z"/></svg>`
   },
   sports: {
      emoji: "🏆",
      gradient: "from-green-950/40 via-emerald-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(34,197,94,0.15)]",
      border: "border-green-500/50 text-green-400"
   },
   geography: {
      emoji: "🌍",
      gradient: "from-sky-950/40 via-sky-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(14,165,233,0.15)]",
      border: "border-sky-500/50 text-sky-400"
   },
   history: {
      emoji: "🏛️",
      gradient: "from-amber-950/40 via-amber-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]",
      border: "border-amber-500/50 text-amber-400"
   },
   general_knowledge: {
      emoji: "💡",
      gradient: "from-purple-950/40 via-violet-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   movies: {
      emoji: "🎬",
      gradient: "from-rose-950/40 via-rose-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(244,63,94,0.15)]",
      border: "border-rose-500/50 text-rose-400"
   },
   television: {
      emoji: "📺",
      gradient: "from-violet-950/40 via-violet-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(139,92,246,0.15)]",
      border: "border-violet-500/50 text-violet-400"
   },
   video_games: {
      emoji: "🎮",
      gradient: "from-fuchsia-950/40 via-fuchsia-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(217,70,239,0.15)]",
      border: "border-fuchsia-500/50 text-fuchsia-400"
   },
   music: {
      emoji: "🎵",
      gradient: "from-cyan-950/40 via-blue-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   animals: {
      emoji: "🐾",
      gradient: "from-yellow-950/40 via-lime-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(132,204,22,0.15)]",
      border: "border-lime-500/50 text-lime-400"
   },
   computers: {
      emoji: "💻",
      gradient: "from-sky-950/40 via-sky-900/20 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(14,165,233,0.15)]",
      border: "border-sky-500/50 text-sky-400"
   }
};

export const DEFAULT_STYLE = {
   emoji: "💡",
   gradient: "from-slate-950/40 via-slate-900/30 to-slate-950/40",
   glow: "shadow-[0_0_15px_rgba(255,255,255,0.05)]",
   border: "border-white/20 text-gray-300"
};
