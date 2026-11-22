-- Add Reverse Wordle to topics
INSERT INTO public.topics (
    slug,
    name,
    emoji,
    procedural_weight,
    handcrafted_weave_probability,
    variant_weights,
    is_active,
    is_suspended,
    is_default_fallback
)
VALUES (
    'reverse_wordle',
    'Reverse Wordle',
    '🔄',
    1.0,
    0.0,
    ARRAY[0, 1, 0, 0, 0, 0, 0, 0, 0],
    true,
    false,
    false
)
ON CONFLICT (slug) DO NOTHING;

