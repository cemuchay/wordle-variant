export const RAINBOW_TILE_PALETTES = [
  {
    name: 'Neon Red / Coral',
    bg: 'from-rose-500 to-red-600',
    border: 'border-rose-400',
    shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.45)]',
    text: 'text-white',
    glow: 'rgba(244,63,94,0.6)',
  },
  {
    name: 'Sunset Orange',
    bg: 'from-orange-500 to-amber-600',
    border: 'border-orange-400',
    shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.45)]',
    text: 'text-white',
    glow: 'rgba(249,115,22,0.6)',
  },
  {
    name: 'Electric Yellow / Gold',
    bg: 'from-amber-400 to-yellow-500',
    border: 'border-yellow-300',
    shadow: 'shadow-[0_0_15px_rgba(234,179,8,0.45)]',
    text: 'text-slate-950 font-black',
    glow: 'rgba(234,179,8,0.6)',
  },
  {
    name: 'Emerald Green',
    bg: 'from-emerald-400 to-green-600',
    border: 'border-emerald-300',
    shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.45)]',
    text: 'text-white',
    glow: 'rgba(16,185,129,0.6)',
  },
  {
    name: 'Neon Cyan',
    bg: 'from-cyan-400 to-teal-500',
    border: 'border-cyan-300',
    shadow: 'shadow-[0_0_15px_rgba(6,182,212,0.45)]',
    text: 'text-slate-950 font-black',
    glow: 'rgba(6,182,212,0.6)',
  },
  {
    name: 'Royal Blue',
    bg: 'from-blue-500 to-indigo-600',
    border: 'border-blue-300',
    shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.45)]',
    text: 'text-white',
    glow: 'rgba(59,130,246,0.6)',
  },
  {
    name: 'Electric Purple',
    bg: 'from-purple-500 to-violet-600',
    border: 'border-purple-300',
    shadow: 'shadow-[0_0_15px_rgba(168,85,247,0.45)]',
    text: 'text-white',
    glow: 'rgba(168,85,247,0.6)',
  },
  {
    name: 'Hot Pink / Magenta',
    bg: 'from-pink-500 to-fuchsia-600',
    border: 'border-pink-300',
    shadow: 'shadow-[0_0_15px_rgba(236,72,153,0.45)]',
    text: 'text-white',
    glow: 'rgba(236,72,153,0.6)',
  },
];

export const SCRABBLE_LETTER_VALUES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
  J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1,
  S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
};
