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

export const CATEGORY_STYLE_MAP: Record<string, { emoji: string; gradient: string; glow: string; border: string }> = {
   mixed: {
      emoji: "🎲",
      gradient: "from-emerald-950/40 via-teal-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(52,211,153,0.15)]",
      border: "border-emerald-500/50 text-emerald-400"
   },
   vowel_drop: {
      emoji: "🅰️",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   anagram_scrambled: {
      emoji: "🔀",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   reverse_wordle: {
      emoji: "🔄",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   missing_letter: {
      emoji: "🧩",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   word_ladder: {
      emoji: "🪜",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   rhyme_match: {
      emoji: "🎵",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   letter_count: {
      emoji: "🔢",
      gradient: "from-purple-950/40 via-indigo-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
      border: "border-purple-500/50 text-purple-400"
   },
   capitals_clash: {
      emoji: "🌍",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   currency_exchange: {
      emoji: "💸",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   flag_bearer: {
      emoji: "🚩",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   mental_math_blitz: {
      emoji: "🧮",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   sequence_solver: {
      emoji: "📈",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   element_arena: {
      emoji: "🧪",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   animal_kingdom: {
      emoji: "🦁",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   cosmic_frontier: {
      emoji: "🚀",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   cinephile_trivia: {
      emoji: "🎬",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   history_milestones: {
      emoji: "🏛️",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   naija_music: {
      emoji: "🎧",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   naija_celebs: {
      emoji: "🇳🇬",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   unn_lions: {
      emoji: "🦁",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   nysc_trivia: {
      emoji: "🪖",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   us_tech_trivia: {
      emoji: "💻",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   },
   elon_musk: {
      emoji: "🚘",
      gradient: "from-cyan-950/40 via-blue-950/30 to-slate-950/40",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      border: "border-cyan-500/50 text-cyan-400"
   }
};

export const DEFAULT_STYLE = {
   emoji: "💡",
   gradient: "from-slate-950/40 via-slate-900/30 to-slate-950/40",
   glow: "shadow-[0_0_15px_rgba(255,255,255,0.05)]",
   border: "border-white/20 text-gray-300"
};
