-- 131_wordup_dynamic_topics.sql
-- Move WordUp topics creation, management, weave probability, procedural weights, and variant weights to database

-- 1. Add configuration columns to public.topics table
ALTER TABLE public.topics
  ADD COLUMN IF NOT EXISTS procedural_weight NUMERIC DEFAULT 0.5 CHECK (procedural_weight BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS handcrafted_weave_probability NUMERIC DEFAULT 0.4 CHECK (handcrafted_weave_probability BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS variant_weights NUMERIC[] DEFAULT '{1,1,1,1,1,1,1,1,1}',
  ADD COLUMN IF NOT EXISTS emoji VARCHAR(20) DEFAULT '💡',
  ADD COLUMN IF NOT EXISTS gradient TEXT DEFAULT 'from-slate-950/40 via-slate-900/30 to-slate-950/40',
  ADD COLUMN IF NOT EXISTS glow TEXT DEFAULT 'shadow-[0_0_15px_rgba(255,255,255,0.05)]',
  ADD COLUMN IF NOT EXISTS border TEXT DEFAULT 'border-white/20 text-gray-300',
  ADD COLUMN IF NOT EXISTS svg TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_default_fallback BOOLEAN DEFAULT false;

-- 2. Upsert baseline topic configurations (exact copy from codebase)
INSERT INTO public.topics (
  slug, name, procedural_weight, handcrafted_weave_probability, variant_weights,
  emoji, gradient, glow, border, svg, is_active, is_suspended, is_default_fallback
) VALUES
('mixed', 'Mixed Categories', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '🎲', 'from-emerald-950/40 via-emerald-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(16,185,129,0.15)]', 'border-emerald-500/50 text-emerald-400', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>', true, false, true),
('maths', 'Maths', 1.0, 0.4, '{3,1,0,2,0,0,0,1,0}', '🧮', 'from-orange-950/40 via-orange-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(249,115,22,0.15)]', 'border-orange-500/50 text-orange-400', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="17" x2="15" y2="17"/></svg>', true, false, false),
('english_language', 'English Language', 1.0, 0.4, '{2.5,1,1,2.5,0,1,0,1,0}', '📚', 'from-blue-950/40 via-blue-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(59,130,246,0.15)]', 'border-blue-500/50 text-blue-400', NULL, true, false, false),
('english_fundamentals', 'English Fundamentals', 0.5, 0.4, '{2.5,1.5,1,2,1,1,1,1,0}', '📖', 'from-teal-950/40 via-teal-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(20,184,166,0.15)]', 'border-teal-500/50 text-teal-400', NULL, true, false, false),
('physics', 'Physics', 0.6, 0.4, '{2.5,1.5,1.5,1.5,2,1,1.5,2.5,0.5}', '🔬', 'from-cyan-950/40 via-cyan-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(6,182,212,0.15)]', 'border-cyan-500/50 text-cyan-400', NULL, true, false, false),
('chemistry', 'Chemistry', 0.0, 0.4, '{2.5,1.5,1.5,1.5,2,1,1.5,2.5,0.5}', '🧪', 'from-emerald-950/40 via-emerald-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(16,185,129,0.15)]', 'border-emerald-500/50 text-emerald-400', NULL, true, false, false),
('football', 'Football', 0.0, 1.0, '{2.5,1.5,1.5,1.5,2,1,1.5,2.5,1}', '⚽', 'from-green-950/40 via-green-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(34,197,94,0.15)]', 'border-green-500/50 text-green-400', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m12 2-2 3.5 2.5 2h3L17.5 4z"/><path d="M12 22v-4.5l-2.5-2h-3L4.5 18z"/><path d="M2 12h4.5l2-2.5v-3L5 5z"/><path d="M22 12h-4.5l-2 2.5v3l3.5 1.5z"/><path d="m9.5 7.5 2.5 2 2.5-2v-3h-5z"/><path d="m9.5 16.5 2.5-2 2.5 2v3h-5z"/></svg>', true, false, false),
('flag_bearer', 'Flag Bearer', 0.5, 0.15, '{3,3,1,3,0,1,1.5,0,0}', '🚩', 'from-fuchsia-950/40 via-fuchsia-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(217,70,239,0.15)]', 'border-fuchsia-500/50 text-fuchsia-400', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>', true, false, false),
('bible', 'Bible Trivia', 0.4, 0.6, '{3,2,1,2.5,1.5,1,1,1,1.5}', '📖', 'from-amber-950/40 via-amber-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(245,158,11,0.15)]', 'border-amber-500/50 text-amber-400', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 2v18"/><path d="M12 6v6"/><path d="M10 8h4"/></svg>', true, false, false),
('animal_kingdom', 'Animal Kingdom', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '🦁', 'from-amber-950/40 via-amber-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(245,158,11,0.15)]', 'border-amber-500/50 text-amber-400', NULL, true, false, false),
('history_milestones', 'History Milestones', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '🏛️', 'from-lime-950/40 via-lime-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(132,204,22,0.15)]', 'border-lime-500/50 text-lime-400', NULL, true, false, false),
('us_tech_trivia', 'US Tech Trivia', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '💻', 'from-blue-950/40 via-sky-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(59,130,246,0.15)]', 'border-blue-500/50 text-blue-400', NULL, true, false, false),
('sports', 'Sports', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '🏆', 'from-green-950/40 via-emerald-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(34,197,94,0.15)]', 'border-green-500/50 text-green-400', NULL, true, false, false),
('geography', 'Geography', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '🌍', 'from-sky-950/40 via-sky-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(14,165,233,0.15)]', 'border-sky-500/50 text-sky-400', NULL, true, false, false),
('history', 'History', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '🏛️', 'from-amber-950/40 via-amber-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(245,158,11,0.15)]', 'border-amber-500/50 text-amber-400', NULL, true, false, false),
('general_knowledge', 'General Knowledge', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '💡', 'from-purple-950/40 via-violet-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(168,85,247,0.15)]', 'border-purple-500/50 text-purple-400', NULL, true, false, false),
('movies', 'Movies', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '🎬', 'from-rose-950/40 via-rose-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(244,63,94,0.15)]', 'border-rose-500/50 text-rose-400', NULL, true, false, false),
('television', 'Television', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '📺', 'from-violet-950/40 via-violet-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(139,92,246,0.15)]', 'border-violet-500/50 text-violet-400', NULL, true, false, false),
('video_games', 'Video Games', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '🎮', 'from-fuchsia-950/40 via-fuchsia-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(217,70,239,0.15)]', 'border-fuchsia-500/50 text-fuchsia-400', NULL, true, false, false),
('music', 'Music', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '🎵', 'from-cyan-950/40 via-blue-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(6,182,212,0.15)]', 'border-cyan-500/50 text-cyan-400', NULL, true, false, false),
('animals', 'Animals', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '🐾', 'from-yellow-950/40 via-lime-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(132,204,22,0.15)]', 'border-lime-500/50 text-lime-400', NULL, true, false, false),
('computers', 'Computers', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '💻', 'from-sky-950/40 via-sky-900/20 to-slate-950/40', 'shadow-[0_0_20px_rgba(14,165,233,0.15)]', 'border-sky-500/50 text-sky-400', NULL, true, false, false),
('global-politics', 'Global Politics', 0.5, 0.4, '{1,1,1,1,1,1,1,1,1}', '🌐', 'from-blue-950/40 via-slate-900/20 to-emerald-950/40', 'shadow-[0_0_20px_rgba(59,130,246,0.15)]', 'border-blue-500/50 text-blue-400', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>', true, false, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  procedural_weight = EXCLUDED.procedural_weight,
  handcrafted_weave_probability = EXCLUDED.handcrafted_weave_probability,
  variant_weights = EXCLUDED.variant_weights,
  emoji = EXCLUDED.emoji,
  gradient = EXCLUDED.gradient,
  glow = EXCLUDED.glow,
  border = EXCLUDED.border,
  svg = EXCLUDED.svg,
  is_suspended = EXCLUDED.is_suspended,
  is_default_fallback = EXCLUDED.is_default_fallback;

-- 3. RLS Admin Policies for Write Access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage topics') THEN
    CREATE POLICY "Admins can manage topics" ON public.topics
      FOR ALL TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;
