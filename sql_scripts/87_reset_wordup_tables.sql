-- 87_reset_wordup_tables.sql

-- Drop all knowledge engine tables with cascade to clear state completely
DROP TABLE IF EXISTS public.wordup_user_entity_history CASCADE;
DROP TABLE IF EXISTS public.question_templates CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.facts CASCADE;
DROP TABLE IF EXISTS public.predicates CASCADE;
DROP TABLE IF EXISTS public.entities CASCADE;
DROP TABLE IF EXISTS public.entity_types CASCADE;
DROP TABLE IF EXISTS public.topics CASCADE;
