export const DAILY_CONFIG = [
   {
      bg: 'from-rose-500/20 via-pink-500/20 to-rose-600/20',
      border: 'border-rose-500/30',
      hoverBorder: 'hover:border-rose-400/50',
      accent: 'bg-rose-500',
      accentHover: 'hover:bg-rose-600',
      textAccent: 'text-rose-400',
      shadowAccent: 'shadow-rose-500/20',
      glow: 'bg-rose-500/5',
      title: 'Sunday Sprint 🏃‍♂️',
      description: 'End your week with a marathon victory!',
   },
   {
      bg: 'from-indigo-600/20 via-blue-600/20 to-indigo-700/20',
      border: 'border-indigo-500/30',
      hoverBorder: 'hover:border-indigo-400/50',
      accent: 'bg-indigo-500',
      accentHover: 'hover:bg-indigo-600',
      textAccent: 'text-indigo-400',
      shadowAccent: 'shadow-indigo-500/20',
      glow: 'bg-indigo-500/5',
      title: 'Monday Motivation 🔋',
      description: 'Start your week strong with a challenge!',
   },
   {
      bg: 'from-emerald-500/20 via-teal-500/20 to-emerald-600/20',
      border: 'border-emerald-500/30',
      hoverBorder: 'hover:border-emerald-400/50',
      accent: 'bg-emerald-500',
      accentHover: 'hover:bg-emerald-600',
      textAccent: 'text-emerald-400',
      shadowAccent: 'shadow-emerald-500/20',
      glow: 'bg-emerald-500/5',
      title: 'Turbo Tuesday ⚡',
      description: 'Pick up the pace in today\'s marathon!',
   },
   {
      bg: 'from-amber-500/20 via-orange-500/20 to-amber-600/20',
      border: 'border-amber-500/30',
      hoverBorder: 'hover:border-amber-400/50',
      accent: 'bg-amber-500',
      accentHover: 'hover:bg-amber-600',
      textAccent: 'text-amber-400',
      shadowAccent: 'shadow-amber-500/20',
      glow: 'bg-amber-500/5',
      title: 'Mid-Week Marathon 🐫',
      description: 'Conquer the hump with a winning streak!',
   },
   {
      bg: 'from-purple-600/20 via-fuchsia-600/20 to-purple-700/20',
      border: 'border-purple-500/30',
      hoverBorder: 'hover:border-purple-400/50',
      accent: 'bg-purple-500',
      accentHover: 'hover:bg-purple-600',
      textAccent: 'text-purple-400',
      shadowAccent: 'shadow-purple-500/20',
      glow: 'bg-purple-500/5',
      title: 'Thriving Thursday 🚀',
      description: 'Push your limits in the daily event!',
   },
   {
      bg: 'from-cyan-500/20 via-blue-500/20 to-cyan-600/20',
      border: 'border-cyan-500/30',
      hoverBorder: 'hover:border-cyan-400/50',
      accent: 'bg-cyan-500',
      accentHover: 'hover:bg-cyan-600',
      textAccent: 'text-cyan-400',
      shadowAccent: 'shadow-cyan-500/20',
      glow: 'bg-cyan-500/5',
      title: 'Friday Flash ⚡',
      description: 'Finish the work week with a bang!',
   },
   {
      bg: 'from-yellow-500/20 via-amber-500/20 to-yellow-600/20',
      border: 'border-yellow-500/30',
      hoverBorder: 'hover:border-yellow-400/50',
      accent: 'bg-yellow-500',
      accentHover: 'hover:bg-yellow-600',
      textAccent: 'text-yellow-400',
      shadowAccent: 'shadow-yellow-500/20',
      glow: 'bg-yellow-500/5',
      title: 'Weekend Warrior ⚔️',
      description: 'The ultimate marathon for the weekend!',
   },
];

export const URGENT_CONFIG = {
   bg: 'from-red-600/30 via-rose-600/30 to-red-700/30',
   border: 'border-red-500/40',
   hoverBorder: 'hover:border-red-400/60',
   accent: 'bg-red-600',
   accentHover: 'hover:bg-red-700',
   textAccent: 'text-red-400',
   shadowAccent: 'shadow-red-500/20',
   glow: 'bg-red-500/5',
   title: 'Ending Soon! 🔥',
   description: 'Today\'s marathon is about to expire. Join the race before it\'s too late!',
};

export function getDayTheme(expiresAt?: string) {
   const dayIndex = new Date().getDay();
   if (expiresAt) {
      const hoursLeft = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursLeft < 18) return URGENT_CONFIG;
   }
   return DAILY_CONFIG[dayIndex];
}
