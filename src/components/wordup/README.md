# WordUp Battles

WordUp Battles is a fast-paced, multi-round word game variant where two players (or a player and a bot) compete head-to-head across 7 rounds of varied word puzzles.

---

## 🎮 Match Statuses

Matches in the `wordup_matches` table transition through the following states:

| Status | Description |
| :--- | :--- |
| `countdown` | The pre-game countdown phase (usually 5–6 seconds) displayed right after matchmaking matches or bot games are established. |
| `active` | Active real-time play. Both players are connected and playing the rounds simultaneously. |
| `waiting` | An asynchronous challenge/match. This status is set when challenging an offline player or when a player doesn't accept a live invitation in time. The game waits for both players to independently play and submit their turns within a 24-hour window. |
| `completed` | The game is finished. Both players have completed their turns, or the match has expired (e.g., live matches inactive for >5 mins or async matches pending for >24 hours). |

---

## 🔄 Game Flow & Modes

### 1. Real-time Matchmaking
- **Queueing**: The user joins the matchmaking queue via a RPC function (`join_wordup_queue`).
- **Match Setup**: If an opponent is found, a match is created with `status: "countdown"`. If no opponent is found within 6 seconds, the game falls back to a bot match.
- **Gameplay**: Both players answer the same questions simultaneously. Each round has a specific duration. Progression to the next round occurs immediately when both submit, or when the timer expires.
- **Resolution**: After 7 rounds, the match is marked as `status: "completed"`.

### 2. Async Challenges (Turn-based)
- **Initiation**: A player challenges another player (online or offline). If the opponent does not answer within 15 seconds or is offline, the match is created with `status: "waiting"`.
- **First Turn**: The challenger plays their 7 rounds immediately. Upon finishing, their answers are saved (`p1_answers`), and their status is flagged as answered (`p1_answered: true`). The match remains in `status: "waiting"`.
- **Second Turn**: The opponent can view this match under their **Pending** tab in the lobby. Clicking **Play Turn** lets them play the 7 rounds independently.
- **Completion**: Once the opponent completes their questions, their answers are stored, both are marked as answered, and `endGame` finalizes the match to `status: "completed"`.

---

## 🗄️ Database Entities & State

The game relies on the following database tables in Supabase:
- **`wordup_matches`**: Holds the match state, including category, player IDs, scores, answers, encrypted questions list, encryption key, status, and timestamps.
- **`wordup_queue`**: A queue table used during matchmaking to pair up online players.
- **`wordup_profiles`**: Tracks player-specific stats like rating (ELO), games played/won/lost/tied, XP, and rank.

---

## 🛠️ Codebase Architecture & File Map

If you want to modify WordUp components or game logic, refer to this guide:

### Core View Container
- **[index.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/wordup/WordUpView/index.tsx)**: Main coordinator of views (Lobby, Matchmaking, Countdown, Battle, Game Over).

### UI Views (`src/components/wordup/WordUpView/components/`)
- **[LobbyView.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/wordup/WordUpView/components/LobbyView.tsx)**: Handles categories selection, online player invites, showing pending turns/history, and sending custom invitations.
- **[MatchmakingView.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/wordup/WordUpView/components/MatchmakingView.tsx)**: UI showing the countdown and searching overlay while matchmaking is active.
- **[CountdownView.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/wordup/WordUpView/components/CountdownView.tsx)**: Displays the short countdown immediately before a match starts.
- **[BattleView.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/wordup/WordUpView/components/BattleView.tsx)**: Main gameplay interface rendering the questions, options, scoreboards, timer bar, quick chat overlay, and answers reveal.
- **[GameOverView.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/wordup/WordUpView/components/GameOverView.tsx)**: Shows final scores, ELO updates, victory/defeat cards, and rematch options.

### Hook Logic (`src/components/wordup/WordUpView/hooks/`)
- **[useWordUpGameLoop.ts](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/wordup/WordUpView/hooks/useWordUpGameLoop.ts)**: Core game loop logic. Handles fetching questions, running timers, managing bot responses, submitting answers, updating realtime state via Supabase broadcast channels, and completing matches.
- **[useWordUpMatchmaking.ts](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/wordup/WordUpView/hooks/useWordUpMatchmaking.ts)**: Matchmaking queue subscription, RPC calls, bot fallback triggers, and cleanup.
- **[useWordUpProfile.ts](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/wordup/WordUpView/hooks/useWordUpProfile.ts)**: Fetches and updates ELO ratings, ranks, and XP for the player.

### Services & Utilities
- **[wordupNetworkGate.ts](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/wordup/WordUpView/services/wordupNetworkGate.ts)**: Implements request queueing and network gating to prevent parallel write conflicts.
- **[constants.ts](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/wordup/WordUpView/constants.ts)**: Defines configuration like category descriptions, ELO rank limits, and colors.
