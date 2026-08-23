// src/utils/wordgrid/playerColors.ts

// Deterministic per-user color schemes so each unique player keeps the same
// identity colors across the score header, play timeline, and board highlights.

export interface PlayerColorScheme {
  key: string;
  name: string;
  chip: string;
  score: string;
  ring: string;
  glowShadow: string;
  badge: string;
  avatarBorder: string;
}

const SCHEMES: Record<string, PlayerColorScheme> = {
  indigo: {
    key: 'indigo',
    name: 'text-indigo-300',
    chip: 'bg-indigo-950/80 border-indigo-700/70 text-indigo-300 hover:bg-indigo-900/80 hover:text-white',
    score: 'text-indigo-300 font-extrabold',
    ring: 'ring-indigo-400 border-indigo-300',
    glowShadow: 'shadow-indigo-500/60',
    badge: 'bg-indigo-500 text-white',
    avatarBorder: 'border-indigo-400',
  },
  rose: {
    key: 'rose',
    name: 'text-rose-300',
    chip: 'bg-rose-950/80 border-rose-700/70 text-rose-300 hover:bg-rose-900/80 hover:text-white',
    score: 'text-rose-300 font-extrabold',
    ring: 'ring-rose-400 border-rose-300',
    glowShadow: 'shadow-rose-500/60',
    badge: 'bg-rose-500 text-white',
    avatarBorder: 'border-rose-400',
  },
  amber: {
    key: 'amber',
    name: 'text-amber-300',
    chip: 'bg-amber-950/80 border-amber-700/70 text-amber-300 hover:bg-amber-900/80 hover:text-white',
    score: 'text-amber-300 font-extrabold',
    ring: 'ring-amber-400 border-amber-300',
    glowShadow: 'shadow-amber-500/60',
    badge: 'bg-amber-500 text-slate-950',
    avatarBorder: 'border-amber-400',
  },
  sky: {
    key: 'sky',
    name: 'text-sky-300',
    chip: 'bg-sky-950/80 border-sky-700/70 text-sky-300 hover:bg-sky-900/80 hover:text-white',
    score: 'text-sky-300 font-extrabold',
    ring: 'ring-sky-400 border-sky-300',
    glowShadow: 'shadow-sky-500/60',
    badge: 'bg-sky-500 text-white',
    avatarBorder: 'border-sky-400',
  },
  violet: {
    key: 'violet',
    name: 'text-violet-300',
    chip: 'bg-violet-950/80 border-violet-700/70 text-violet-300 hover:bg-violet-900/80 hover:text-white',
    score: 'text-violet-300 font-extrabold',
    ring: 'ring-violet-400 border-violet-300',
    glowShadow: 'shadow-violet-500/60',
    badge: 'bg-violet-500 text-white',
    avatarBorder: 'border-violet-400',
  },
  emerald: {
    key: 'emerald',
    name: 'text-emerald-300',
    chip: 'bg-emerald-950/80 border-emerald-700/70 text-emerald-300 hover:bg-emerald-900/80 hover:text-white',
    score: 'text-emerald-300 font-extrabold',
    ring: 'ring-emerald-400 border-emerald-300',
    glowShadow: 'shadow-emerald-500/60',
    badge: 'bg-emerald-500 text-slate-950',
    avatarBorder: 'border-emerald-400',
  },
};

// Emerald is reserved for the bot to stay consistent with existing bot theming.
const HUMAN_KEYS = ['indigo', 'rose', 'amber', 'sky', 'violet'];

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getPlayerColorKey(id: string | null | undefined): string {
  if (!id || id === 'bot') return 'emerald';
  return HUMAN_KEYS[hashCode(id) % HUMAN_KEYS.length];
}

export function getPlayerColorScheme(id: string | null | undefined): PlayerColorScheme {
  return SCHEMES[getPlayerColorKey(id)] || SCHEMES.indigo;
}

/**
 * Assigns distinct color schemes per player, greedily avoiding collisions.
 * Bot always maps to emerald. Human players hash into the remaining keys,
 * walking forward when a scheme is already taken.
 */
export function buildPlayerColorMap(
  playerIds: (string | null | undefined)[]
): Record<string, PlayerColorScheme> {
  const map: Record<string, PlayerColorScheme> = {};
  const used = new Set<string>();
  const ids = (playerIds || []).filter((id): id is string => !!id);

  ids.forEach((id) => {
    if (id === 'bot') {
      used.add('emerald');
      map[id] = SCHEMES.emerald;
      return;
    }
    const start = hashCode(id) % HUMAN_KEYS.length;
    let chosen = '';
    for (let i = 0; i < HUMAN_KEYS.length; i++) {
      const candidate = HUMAN_KEYS[(start + i) % HUMAN_KEYS.length];
      if (!used.has(candidate)) {
        chosen = candidate;
        break;
      }
    }
    if (!chosen) chosen = HUMAN_KEYS[start];
    used.add(chosen);
    map[id] = SCHEMES[chosen];
  });

  return map;
}
