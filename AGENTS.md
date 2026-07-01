# AGENTS.md

## Project

Variant is a multiplayer word game inspired by Wordle and QuizUp.

Tech stack:

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- Zustand
- TanStack Query
- Supabase
- Vitest
- Playwright

---

## General Rules

- Prefer TypeScript over JavaScript.
- Never use `any` unless absolutely necessary.
- Prefer functional components.
- Prefer composition over prop drilling.
- Keep components small and focused.
- Keep business logic outside UI components whenever possible.
- Use existing utilities before creating new ones.
- No modifications to existing sql_scripts, new change new file

---

## Code Style

- Use arrow functions.
- Prefer `const`.
- Use early returns.
- Avoid nested conditionals.
- Keep functions under ~50 lines where practical.
- Use descriptive variable names.

---

## React

- Keep components as presentational as possible.
- Extract reusable hooks into `/hooks`.
- Memoize only when profiling shows benefit.
- Avoid unnecessary effects.
- Derive state instead of duplicating it.
- Adhere to the rules of react

---

## State Management

Local UI state:

- React state

Shared client state:

- Zustand

Server state:

- TanStack Query

Realtime / persistence:

- Supabase

Do not duplicate the same state across multiple stores.

---

## Styling

- Tailwind CSS only.
- Prefer utility classes.
- Reuse existing component styles.
- Avoid inline styles unless dynamic.

---

## Testing

Before finishing work:

Run

```bash
npm test
```

For UI changes also run

```bash
npm run test:e2e
```

---

## Performance

Prefer

- lazy loading
- code splitting
- memoization only where useful
- avoiding unnecessary renders

Always consider bundle size.

---

## Git

Make focused commits.

Avoid unrelated changes.

Never modify generated files unless required.

---

## If Unsure

Prefer asking for clarification instead of making assumptions.

## Project Documentation

Before making architectural or product decisions, consult:

- SPEC.md
- ARCHITECTURE.md
- TASKS.md
