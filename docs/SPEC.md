# SPEC.md

# Variant

## Vision

Variant is a fast, competitive multiplayer word game platform with multiple game modes rather than a single Wordle clone.

The experience should feel:

- fast
- polished
- social
- highly replayable

---

# Core Principles

1. Gameplay first
2. Fast interactions
3. Minimal loading
4. Mobile-first
5. Competitive multiplayer
6. Accessible UI

---

# Tech Stack

Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

Backend

- Supabase
- PostgreSQL
- Realtime

State

- Zustand
- TanStack Query

Testing

- Vitest
- Playwright

---

# Game Modes

Current and planned modes include:

- Classic Word Guess
- Quick Match
- Vowel Drop
- Anagrams
- Category Challenges
- Image Questions
- Trivia
- Timed Modes

Additional modes should fit the competitive multiplayer experience.

---

# Design Goals

UI should be

- clean
- modern
- responsive
- minimal
- animation should enhance UX, not distract

Use Framer Motion sparingly.

---

# Performance Goals

- Fast initial load
- Small bundles
- Minimal rerenders
- Efficient Supabase queries
- Cache aggressively where appropriate

---

# Code Organization

Prefer

/components
/hooks
/lib
/services
/store
/types
/utils

Business logic should not live inside UI components.

---

# Quality Requirements

New features should

- be typed
- include reasonable tests
- avoid regressions
- maintain existing UX consistency

---

# Non-Goals

Avoid

- over-engineering
- premature abstraction
- unnecessary dependencies
- large refactors without request

---

# Decision Priority

When multiple solutions exist, prioritize:

1. Correctness
2. Simplicity
3. Readability
4. Performance
5. Cleverness
