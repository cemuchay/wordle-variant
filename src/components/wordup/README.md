# WordUp Battles

WordUp Battles is a fast-paced, multi-round word game variant where two players (or a player and a bot) compete head-to-head across 7 rounds of varied word puzzles.

---

## 🎮 Match Statuses

Matches in the `wordup_matches` table transition through the following states:

| Status | Description |
| :--- | :--- |
| `countdown` | The pre-game countdown phase (3 seconds) displayed right after matchmaking matches or bot games are established. |
| `active` | Active real-time play. Both players are connected and playing the rounds simultaneously. Set by player2 or bot matches upon countdown completion. |
| `waiting` | An asynchronous challenge/match. Set when challenging an offline player or when a player doesn't accept a live invitation in 15 seconds. Each player plays independently and the match advances when both have answered. |
| `completed` | The game is finished. Both players have completed all 7 rounds, or the match has expired (live matches inactive >5 mins or async matches pending >24 hours). |

---

## 🔄 Game Flow & Modes

### 1. Real-time Matchmaking (Live)
- **Queueing**: The user joins the matchmaking queue via `join_wordup_queue` RPC.
- **Match Setup**: If an opponent is found, player2 sets questions and match becomes `countdown`. If no opponent is found within 10 seconds, falls back to a bot match.
- **Gameplay**: Both players answer the same 7 questions simultaneously via Supabase broadcast channels. Progression occurs when both submit or when the timer expires.
- **Resolution**: After round 7, `endGame` finalizes the match to `status: "completed"`. ELO and XP are calculated and saved.

### 2. Async Challenges (Turn-based)
- **Initiation**: The challenger invites a player. If the opponent doesn't respond within 15 seconds or is offline, a match is created with `status: "waiting"` and `game_type: "async"`.
- **First Turn**: The challenger plays their 7 rounds immediately. After finishing, their answers are saved and they return to the lobby. Match stays in `status: "waiting"`.
- **Second Turn**: The opponent sees the match under the **Pending** tab in the lobby. Clicking **Play Turn** starts the 7 rounds.
- **Completion**: When the opponent finishes, both are marked answered, and `endGame` finalizes the match to `completed`.

### 3. Bot Games (Local & DB)
- **Local Fallback**: When matchmaking times out after 10 seconds, a local bot match is created with ID prefix `bot-match-`. Questions are generated client-side; no DB row is created until the game ends.
- **DB Bot Matches**: Bot matches can also be created in the database (via rematch or pre-created rows) with `is_bot_match: true` and `game_type: "live-bot"`.
- **Bot Profiles**: Bots have configurable difficulty profiles (`average`, `slow_thinker`, `gold`, `expert`, `master`, `impossible`) affecting response accuracy and speed via `simulateBotResponse`.

### 4. Guest Mode
- Unauthenticated users can play by entering a nickname. A guest profile is upserted into the `guest_profiles` table.
- Guest ID and username are persisted in `localStorage` (`wordle_anon_id`, `wordle_anon_username`).
- Guests can play all modes but stats won't persist to `wordup_profiles` unless they log in.

---

## 🗄️ Database Entities

- **`wordup_matches`**: Match state including category, player IDs, scores, answers (JSON arrays), encrypted questions, encryption key, status, timestamps, `game_type` (live/live-bot/async), `bot_profile`, and `is_bot_match`.
- **`wordup_queue`**: Queue table for matchmaking pairing.
- **`wordup_profiles`**: Player stats — rating (ELO), XP, games played/won/lost/tied, rank name, `updated_at` (for decay).
- **`guest_profiles`**: Stores guest player ID, username, and avatar URL.
- **`profiles`**: Main app user profiles (username, avatar URL).

---

## 📐 Categories

Defined in `constants.ts`, categories filter which question types appear:

| Category | Type | Description |
| :--- | :--- | :--- |
| `mixed` | general | All question types, random word lengths |
| `3_letters` | length | Short 3-letter words |
| `4_letters` | length | 4-letter words |
| `5_letters` | length | Perfect for Wordle masters |
| `6_letters` | length | Advanced length patterns |
| `7_plus` | length | 7+ letters (Diamond) |
| `vowel_drop` | game_type | Without vowels |
| `anagram_scrambled` | game_type | Decipher scrambled letters |
| `reverse_wordle` | game_type | Deduce target from match grid |
| `missing_letter` | game_type | Identify the correct missing letter |
| `word_ladder` | game_type | One letter edit away |
| `rhyme_match` | game_type | Rhyming words |
| `letter_count` | game_type | Count vowels/consonants |

---

## 🛠️ Codebase Architecture & File Map

### Core View Container
- **`index.tsx`**: Main coordinator. Manages views (menu, connecting, matchmaking, countdown, battle, gameover, loading). Handles guest auth, sound toggle, countdown, match purge/reset, safety timer (15s abort), refresh recovery (persists `wordup_active_game` to localStorage), and delegates to hooks.

### UI Views (`src/components/wordup/WordUpView/components/`)

- **`LobbyView.tsx`**: Four-tab interface (Play, Rankings, Pending, History). Category selection, online player invites (with 15s ring timeout), offline/async challenge flow, player search, ELO/rank display, sound/reset controls, collapsible help section with scoring rules. Subscribes to realtime match changes and manages notification state for completed async matches.
- **`MatchmakingView.tsx`**: Spinner overlay with countdown showing "Bot joins in X seconds...".
- **`ConnectingView.tsx`**: Shown before matchmaking starts — "Entering Arena / Connecting to Server".
- **`CountdownView.tsx`**: Displays the 3-2-1 countdown before battle starts.
- **`LoadingView.tsx`**: Generic loading spinner ("Preparing Arena...").
- **`BattleView.tsx`**: Core gameplay — question prompt, choices grid with correct/incorrect animations, timer bar, scoreboard, player status indicators (Thinking/Submitted/Syncing), opponent answer reveal, prefilled quick chat row, floating chat bubbles, and confetti particle effects on correct answers.
- **`GameOverView.tsx`**: Win/draw/loss screen with scores, ELO/XP summary, rematch actions (idle/sent/received/expired), "Play Again" button, and full round-by-round breakdown.
- **`ConnectionOverlay.tsx`**: Full-screen overlay shown when realtime disconnects during battle.
- **`CategorySelectModal.tsx`**: Modal with search bar for filtering categories grouped by General / Word Length / Game Type. Includes direct "Play Mode" button.
- **`RankingView.tsx`**: Global leaderboard — top 30 active players by ELO, with decayed rating calculation, win/loss ratios, and current user rank position if outside top 30.

### Hook Logic (`src/components/wordup/WordUpView/hooks/`)

- **`useWordUpGameLoop.ts`**: Coordinator hook that detects game type (`live`, `live-bot`, `async`) from matchData and delegates to the appropriate sub-hook. Exposes `getQuestionDuration()` helper mapping question types to time limits.
- **`useWordUpLiveGame.ts`**: Real-time PvP game logic. Handles match subscription via Supabase broadcast channels, answer submission, timer, round advancement (triggers when both answered or timer expires), reveal phase, match state merging (avoids stale local state), endGame DB finalization, auto-expiration for matches >5 min old, rematch flow (request/accept with countdown), quick chat, and local state persistence.
- **`useWordUpBotGame.ts`**: Bot game logic. Generates questions locally for `bot-match-` IDs, simulates bot responses via `simulateBotResponse`, handles answer submission, timer, endGame (inserts or updates DB row), rematch via DB, and quick chat (local dispatch only).
- **`useWordUpAsyncGame.ts`**: Async/turn-based game logic. No broadcast channels — saves progress after each full playthrough. When both players have answered 7 rounds, calls endGame. Otherwise saves partial state and returns to lobby with toast.
- **`useMatchmaking.ts`**: Manages matchmaking queue via `join_wordup_queue` RPC. Subscribes to INSERT/UPDATE on `wordup_matches` for player1-side match detection. Handles bot fallback after 10s countdown, queue cancellation, and network-gated RPC calls.
- **`useWordUpProfile.ts`**: Fetches/creates `wordup_profiles`, applies inactivity ELO decay (15 points per 7 days inactive), and provides `updateStats` with Chess ELO formula (K=32) + accuracy bonus.
- **`useServerTime.ts`**: Syncs with `get_server_time` RPC to estimate clock offset for accurate round timing.

### Services & Utilities
- **`wordupNetworkGate.ts`**: Request queuing system that prevents parallel write conflicts. Supports blocking tasks (rating updates, match finalization) that pause subsequent operations.
- **`constants.ts`**: Category definitions and configuration.

---

## 🧠 Key Mechanics

### Scoring
- **Correct answer**: 100 base points + up to 50 speed bonus (decays linearly with time).
- **Round 7 (Final)**: All points are **doubled**.
- **ELO**: Chess-based formula (K=32) with accuracy bonus (won + correct answers). Min/max safety bounds prevent rating loss on win or gain on loss.
- **XP**: 50 base + 100 win bonus + 10 per correct answer.

### Inactivity ELO Decay
- After 7 days of inactivity, rating decays by 15 points per additional week (floor 600), recalculating rank accordingly.

### Refresh Recovery
- Active game state is persisted to `localStorage` (`wordup_active_game`). On remount, the game is restored to the battle view and resubscribed.

### Safety Timer
- If stuck in `loading` or `countdown` for >15 seconds, the game aborts to the lobby with a toast.

### Rematch System
- Live matches support rematch via broadcast channels. State machine: `idle` → `sent` / `received` → `expired`. 20-second timeout. Auto-accept logic if both players sent simultaneously (deterministic by user ID comparison).

### Network Gating
- All DB writes go through `wordupNetworkGate` which serializes blocking tasks (e.g., rating updates, match finalization) to prevent race conditions.
