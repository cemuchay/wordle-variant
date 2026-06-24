# Testing Instructions

## Quick Start

```bash
# Run all vitest tests (unit + integration + component)
npm test

# Single run (no watch mode)
npm run test:run
```

## Run Specific Test Groups

```bash
# All test files matching a pattern
npx vitest run src/__tests__/flows

# A single test file
npx vitest run src/__tests__/flows/scoring.test.tsx

# Integration tests (real hooks, mocked Supabase)
npx vitest run src/__tests__/integration

# Component tests
npx vitest run src/__tests__/components

# Regression tests (guards for previous bug fixes)
npx vitest run src/__tests__/regression

# Infrastructure/smoke tests
npx vitest run src/__tests__/smoke.test.tsx
```

## Watch Mode

```bash
npm run test:watch
```

## Playwright E2E Tests

Requires the dev server running (Playwright starts it automatically).

```bash
npm run test:e2e
```

## TypeScript & Build Checks

```bash
# TypeScript type check only
npx tsc -b --noEmit

# Full production build (tsc + vite)
npm run build
```

## What CI Runs

The workflow in `.github/workflows/test.yml` runs on every push/PR:

```bash
npx tsc -b --noEmit   # TypeScript check
npx vitest run         # All vitest tests
npx playwright test    # Playwright E2E smoke tests
npm run build          # Production build
```

## Test Architecture

```
Layer 1: Infrastructure tests  (smoke.test.tsx)
  - verifies vitest, happy-dom, mock Supabase, mock tables all work

Layer 2: Component + view rendering  (11 files, mocked hooks)
  - tests that each view state renders the correct sub-component
  - tests user interactions (button clicks, score display)
  - hooks are mocked; no real Supabase or game logic runs

Layer 3: Scoring formulas  (scoring.test.tsx)
  - pure function tests for ELO calculation and XP rewards
  - verifies clamping, edge cases, and L1 bug fix

Layer 4: Regression guards  (c1-to-l4.test.tsx)
  - named tests for all 18 previously-fixed bugs
  - if a fix is reverted, the test fails

Layer 5: Hook integration  (integration/*.test.tsx)
  - uses REAL hooks (useWordUpGameLoop, useWordUpLiveGame, etc.)
  - only Supabase is mocked (via global vi.mock in setup.ts)
  - tests the full loading → countdown transition
  - if a hook throws or stops calling setView, this catches it

Layer 6: E2E browser tests  (e2e/specs/*.spec.ts)
  - Playwright in real Chromium
  - guest login, app loading, lobby tabs
```

## Test Data

Fixtures live in `src/__tests__/fixtures/`:

```ts
makeLiveMatch()     // full match object with status: "active", game_type: "live"
makeBotMatch()      // match with player2_id set to bot UUID, is_bot_match: true
makeAsyncMatch()    // match with game_type: "async"
makeQuestionSet(n)  // array of n WordUpQuestion objects
makeProfile()       // wordup_profiles row
```

## Writing New Tests

1. **Component test**: seed Zustand store with `seedStore()`, render component, assert DOM
2. **Flow test**: mock hooks (see existing files for the vi.mock pattern), seed store, verify renders
3. **Integration test**: only mock `useAuth`, `useApp`, and `decryptMatchQuestions`; leave real hooks unmocked; seed mock Supabase tables via `mock.setTableData()`
4. **Regression test**: add to `src/__tests__/regression/c1-to-l4.test.tsx`
