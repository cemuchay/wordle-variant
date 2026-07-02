# Variant Architecture

## 1. Overview

Variant is a multiplayer word game platform. It combines a daily Wordle-style puzzle with **WordUp** — a competitive multiplayer trivia/word battle mode available in two flavors: **live** (real-time) and **async** (turn-based).

### Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, TypeScript, Tailwind CSS v4 |
| Build | Vite 8, TypeScript 6 |
| Client State | Zustand 5 |
| Server State | TanStack Query 5 |
| Backend / DB | Supabase (PostgreSQL + Realtime) |
| Audio / Voice | Agora RTC SDK |
| Testing | Vitest (unit/integration), Playwright (E2E) |
| Deploy | Vercel |

### Key Design Principles

- **Gameplay first** — fast interactions, minimal loading, mobile-first
- **Business logic outside UI** — hooks and services own logic, components stay presentational
- **Dual persistence** — writes go to both memory + native storage with IndexedDB fallback
- **Deterministic question generation** — seeded RNG ensures both players in a match get identical questions
- **Offline-capable async** — turn-based matches survive tab closes and network interruptions

---

## 2. Directory Structure

```
src/
├── __tests__/           # Test suites (fixtures, flows, integration, regression, mocks)
├── assets/              # Static assets (images, icons)
├── components/          # Shared UI components
│   ├── admin/           # Admin dashboard
│   ├── challenge/       # Challenge creation, lobby, gameplay
│   ├── chat/            # Full chat system (messages, reactions, voice)
│   ├── common/          # Reusable UI (ImageModal, Skeletons)
│   ├── guess-preview/   # Guess grid, score breakdown
│   ├── layout/          # App shell (AppHeader, AppNavigation, GameArea, ModalsManager)
│   ├── notifications/   # Bell, modal, toast, manager
│   └── wordup/          # Legacy WordUp components + PreloadedImage
├── constants/           # App-wide constants (game config, challenge, marathon, UI, Wordup)
├── context/             # React Contexts (AppProvider, ChallengeProvider, etc.)
├── data/                # Word lists, sentences, announcements
├── hooks/               # Custom React hooks
│   ├── queries/         # TanStack Query hooks (useServerData, useChallengeQueries)
│   ├── useGameEngine/   # Daily Wordle game engine
│   ├── useChallengeGameEngine/ # Challenge game engine
│   └── ...              # Global hooks (useAuth, useChat, useAudioChat, etc.)
├── lib/                 # Core infrastructure
│   ├── supabaseClient.ts   # Single Supabase client instance
│   ├── game-logic/         # Daily game logic (sync, validation, config)
│   ├── pushService.ts      # Web Push API subscription
│   └── time.ts             # Server time sync
├── reducers/            # Pure reducers for game engines
├── services/
│   └── wordup/          # Question generation orchestration
│       ├── generators/  # 10 procedural quiz generators
│       ├── questionService.ts    # Entry point (routes to edge function or local)
│       ├── generatorRegistry.ts  # Maps categories to generators
│       └── legacyWordEngine.ts   # Client-side word question engine
├── store/               # Zustand stores
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
│   ├── storage.ts       # SafeStorage (IndexedDB + localStorage wrapper)
│   ├── wordupQuestionGenerator.ts # Client-side question generation (2337 lines)
│   ├── wordupAudio.ts           # Web Audio API sound manager
│   └── roastEngine.ts          # Game analysis + roast generation
└── wordup/              # WordUp multiplayer battles
    ├── shared/          # Shared types, constants, hooks (useServerTime, useWordUpProfile)
    ├── mode-select/     # Mode selection screen (Live vs Async)
    ├── live/            # Real-time live battle
    └── async/           # Turn-based async battle
```

---

## 3. State Management

Three layers handle state:

### 3a. Zustand Stores

| Store | State | Persistence |
|-------|-------|-------------|
| `useAppStore` | Global UI (toasts, modals, preferences, stats, call state, chat state, WordUp mode, PWA status) | IndexedDB via Zustand `persist` middleware |
| `useChallengeStore` | Challenge form, selection, filters, navigation | None (session via `ChallengeContext`) |
| `useWordUpStore` | Daily WordUp battle (view, category, questions, timer, answers) | Session (tab + category to `safeSessionStorage`) |
| `useLiveStore` | Live WordUp battle (same shape as WordUp) | Session (tab + category, active game to `safeLocalStorage`) |
| `useAsyncStore` | Async WordUp battle (same shape, plus `turn_submitted` view) | Session (tab + category, active game to `safeLocalStorage`) |
| `useVoicePlaybackStore` | Voice message audio playback | None |

### 3b. React Contexts

| Context | Purpose |
|---------|---------|
| `AppContext` | Global orchestration — bridges Zustand, TanStack Query, and Supabase Realtime. Handles call signaling, presence, WordUp invites, toast, realtime status. |
| `ChallengeContext` | Challenge lifecycle — fetches data via TanStack Query, wraps mutations, manages selection state, auto-joins challenges. |
| `ChallengeFiltersContext` | Pure computation — filters challenge lists based on search/filter state from `useChallengeStore`. |
| `ConfirmationContext` | Promise-based confirmation modal (`ask()` returns `boolean`). |

### 3c. TanStack Query (Server State)

All server state goes through TanStack Query. Key patterns:

- **`enabled: !!userId`** — queries gate on auth
- **`placeholderData` from localStorage** — instant hydration before network resolves
- **`staleTime` per query** — 30s (challenges), 1hr (server date), 24hr (profile)
- **`queryClient.invalidateQueries` in mutation `onSuccess`** — cache busting
- **Realtime + Query hybrid** — Supabase `postgres_changes` subscriptions optimistically update the cache

Key query hooks: `useAuthoritativeDate()`, `useProfile(userId)`, `useMyChallenges()`, `useDiscoverChallenges()`, `useChallengeParticipants()`.

---

## 4. App Flow & Routing

```
main.tsx → App.tsx
            │
            ├── DailyGame (activeNavigationItem === "play")
            ├── Chat (activeNavigationItem === "chat")
            ├── Leaderboard (activeNavigationItem === "leaderboard")
            └── WordUp (activeNavigationItem === "wordup")
                    │
                    ├── ModeSelect (wordupMode === null)
                    ├── LiveView (wordupMode === "live")
                    └── AsyncView (wordupMode === "async")
```

Navigation is handled by `handleNavigation()` in App.tsx which sets the `activeNavigationItem`. The WordUp mode is stored in `safeLocalStorage` (`wordup_mode`) so it persists across sessions.

Each mode's view receives:
- `onBack` — returns to mode select (`setWordupMode(null)`)
- `onSwitchMode` — directly switches between live/async (`setWordupMode("live"|"async")`)

---

## 5. WordUp Multiplayer Architecture

### 5a. Shared (`src/wordup/shared/`)

| File | Purpose |
|------|---------|
| `types.ts` | `ProfileStats` interface |
| `constants.ts` | `CATEGORIES` array (30+ categories), `FLAG_MAP` (~200 countries) |
| `useServerTime.ts` | Server clock offset for fair timing |
| `useWordUpProfile.ts` | Fetch/create `wordup_profiles`, apply ELO decay, update stats after game |

### 5b. Live Mode (`src/wordup/live/`)

Real-time battles using Supabase Realtime channels. Flow:

1. User enters lobby → matchmaking subscribes to `wordup_matchmaking` presence channel
2. Match found → `startMatch(matchId, role)` → engine loads questions, starts countdown
3. Both players answer 7 rounds in sync → answers broadcast via `wordup_match_signals_{matchId}`
4. After round 7 → results calculated, gameover view shown

**Key differences from async:**
- Both players play simultaneously (identical countdown + timing)
- Answers stream in real-time via Realtime
- Matchmaking uses Supabase presence instead of invites
- ELO/Rating calculated immediately for both

### 5c. Async Mode (`src/wordup/async/`)

Turn-based battles. Flow:

1. Challenger selects opponent → `createMatch(targetUser)` inserts row in `wordup_async_matches`
2. Invite sent via `user_signals_{targetUser.id}` Realtime channel
3. Opponent accepts/later/declines via `wordup_async_match_signals_{matchId}` channel
4. If accepted → both set view to `"loading"` → auto-trigger `useEffect` calls `startMatch`
5. Players take turns answering 7 rounds → each turn saves to DB
6. When both have played → match marked complete, gameover shown

**Key differences from live:**
- Turns are asynchronous — no real-time opponent presence required
- Match data persisted to `wordup_async_matches` table
- View includes `"turn_submitted"` state (waiting for opponent)
- Invite supports 3 responses: accept, later (save as pending), decline

### 5d. View Lifecycle (both modes)

```
menu → loading → countdown → battle → gameover
         ↓                          ↑
      (recovery)               turn_submitted (async only)
```

- **menu** — LobbyView (categories, match history, challenge players)
- **loading** — decrypting questions, setting up engine
- **countdown** — 3-2-1 pre-game countdown
- **battle** — 7 rounds of questions (10s each), answer selection, round transitions
- **turn_submitted** — async only, waiting for opponent's turn
- **gameover** — scores, round breakdown, rating/XP change

---

## 6. Question Generation Pipeline

```
questionService.generateMatchQuestions(matchId, category)
    │
    ├── isProceduralCategory(category)?
    │       YES → GeneratorRegistry.compileMatchQuestions()
    │               │
    │               ├── Find matching QuizGenerator (e.g., flag_bearer → FlagBearerGenerator)
    │               ├── Optionally fetchEntities() from Supabase
    │               ├── generator.generate(seed, entity) × 7 rounds
    │               └── Returns BaseQuestion[]
    │                    │
    │               baseQuestionsToWordUpQuestions() [adapter]
    │                    ↓
    │               WordUpQuestion[]
    │
    └── NO → legacyWordEngine.generateLegacyBatch()
                │
                ├── generateWordUpQuestions(category) [utils]
                │       (22 question types, weighted random, no consecutive dupes)
                │
                └── WordUpQuestion[]

Questions encrypted (XOR or AES-GCM) → saved to wordup_matches table
Players fetch + decrypt during match
```

**Procedural categories** (10 generators): capitals_clash, currency_exchange, flag_bearer, mental_math_blitz, sequence_solver, element_arena, animal_kingdom, cosmic_frontier, cinephile_trivia, history_milestones

**Legacy word categories**: mixed, 5_letters, 6_letters, 7_letters, anagram_scrambled, word_within_word, compound_break, and ~30 others

---

## 7. Storage & Persistence

### SafeStorage (`src/utils/storage.ts`)

A fail-safe wrapper around `localStorage` and `sessionStorage`:

- Writes to **memory** instantly + **native storage** + **IndexedDB** (debounced 500ms flush)
- Reads from **memory first**, fallback to native storage
- If `localStorage` is unavailable (quota exceeded, private browsing), falls back to in-memory store
- Typed API: `getItem`, `setItem`, `removeItem`, `getAllKeys`

Two pre-configured instances:
- `safeLocalStorage` — persists across sessions
- `safeSessionStorage` — cleared on tab close

### Zustand Persistence Middleware

`useAppStore` uses `persist()` with `createJSONStorage(() => asyncStorage)` where `asyncStorage` wraps `safeLocalStorage`. The `partialize` option whitelists persisted keys: `preferences`, `stats`, `myParticipations`, `readReceipts`, `joinedGroupIds`, `challengePresets`.

### Session-Stored Preferences

WordUp stores view preferences per mode in `safeSessionStorage`:
- `wordup_live_tab`, `wordup_async_tab` — active tab (play/rankings/history)
- `wordup_selected_category` — last-used category in each mode
- Active game recovery: `wordup_active_game`, `wordup_async_active_game` in `safeLocalStorage`

---

## 8. Real-Time Communication

Supabase Realtime channels power all live features:

| Purpose | Channel Pattern | Events |
|---------|----------------|--------|
| Presence tracking | `global-presence` | User online/offline status |
| Matchmaking (live) | `wordup_matchmaking` | Presence-based queue |
| Match signals (live) | `wordup_match_signals_{matchId}` | Answers, round sync, quick chat |
| Match signals (async) | `wordup_async_match_signals_{matchId}` | Invite accept/later/decline |
| User signaling | `user_signals_{userId}` | WordUp invites, call signaling |
| DB changes (async) | `wordup_async_lobby_{userId}` | `postgres_changes` on `wordup_async_matches` |
| Chat | (global messages subscription) | Real-time message delivery |
| Call signaling | `user_signals_{userId}` | `incoming_call`, `call_accepted`, `hang_up` |

Connection health is monitored in AppContext — a `realtimeStatus` field tracks `connected`/`reconnecting`/`error` and shows a reconnection overlay.

---

## 9. Game Engines

### Daily Game (`useGameEngine` + `gameReducer`)

Pure reducer-based state machine for the classic Wordle-style puzzle:
- Actions: `ADD_LETTER`, `DELETE_LETTER`, `SUBMIT_GUESS`, `SET_HINT`, `SHAKE_GUESS`
- Persisted to localStorage for recovery
- Synced to Supabase `scores` table via TanStack Query

### Challenge Game (`useChallengeGameEngine` + `challengeReducer`)

Turn-based challenges against friends or bots:
- Timer-based (configurable per game type)
- Bot word generation for solo practice
- Marathon mode: sequential games with cumulative scoring

### WordUp Live (`useGameEngine` in `src/wordup/live/`)

Real-time 7-round battle engine:
- Both players see identical questions (seeded RNG)
- Answers sent via Realtime channel
- Round advancement synced to server timing
- Supports `sendQuickChat`, `rematch`, `abortMatch`

### WordUp Async (`useGameEngine` in `src/wordup/async/`)

Turn-based 7-round battle engine:
- Questions pre-generated and encrypted at match creation
- Answer submission writes to DB, sets `turn_submitted` status
- `postgres_changes` subscription triggers refresh when opponent plays
- Game recovery from `safeLocalStorage` on page refresh

---

## 10. Testing

| Layer | Tool | Location | Coverage |
|-------|------|----------|----------|
| Unit | Vitest | `src/utils/__tests__/` | Storage, migration, Supabase client |
| Unit | Vitest | `src/store/__tests__/` | App store |
| Unit | Vitest | `src/lib/__tests__/` | Supabase client mock |
| Unit | Vitest | `src/lib/game-logic/` | Daily config, skill index |
| Integration | Vitest | `src/__tests__/flows/` | Full game lifecycle (async, live, bot, recovery, rematch, scoring, view states) |
| Integration | Vitest | `src/__tests__/integration/` | End-to-end game flows with mocked Supabase |
| Regression | Vitest | `src/__tests__/regression/` | Critical bug prevention (C1-C4, L1-L4) |
| E2E | Playwright | `e2e/` | Browser-level tests |

Test helpers: `src/__tests__/helpers/` provides `renderWordUp`, `seedStore`, `waitForStore`. Mock Supabase in `src/__tests__/mocks/supabase.ts`.

---

## 11. Key Data Flow: Question Generation

```
                     App.tsx
                        │
            ┌───────────┴───────────┐
            │                       │
        LiveView               AsyncView
            │                       │
    useGameEngine()          useGameEngine()
            │                       │
            │              createMatch() → Supabase INSERT
            │                       │
            │              questionService.generateMatchQuestions()
            │                       │
     Edge Function           ┌──────┴──────┐
        (server)          Procedural    Legacy Word
            │             (10 gens)    (client-side)
            │                  │            │
            └──────┬───────────┘            │
                   │                        │
              encrypt questions         encrypt (XOR)
                   │                        │
              save to DB               save to DB
                   │                        │
            ┌──────┘                        │
            │                               │
    Both players decrypt & play (parallel / turn-based)
            │
            ↓
    onGameOver(match) → updateStats(eloGain, xpReward, won, tied)
                           │
                           ↓
                      Supabase `wordup_profiles`
```

The 10 procedural generators produce `BaseQuestion` objects that flow through `baseQuestionAdapter` → `WordUpQuestion` format. Legacy word questions are generated directly as `WordUpQuestion` by `generateWordUpQuestions()`. Both paths encrypt the result before writing to the database. Players fetch and decrypt on match start.
