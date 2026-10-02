# Game Specification & Architecture Plan: Word Scramble Matrix (Working Title: **"Word Scramble" / "Letter Grid Hunt"**)

---

## 1. Executive Summary & Core Game Concept

A high-tempo, modular anagram tile/matrix word hunt game added under the **"More Games"** suite.
- **Core Loop**:
  - The game generates a tile grid by spooling secret valid base words (from our combined TWL / Scrabble & Wordle dictionary datasets) matching selected lengths (3L to 10L, single length or multi-length mix of up to 3 chosen lengths).
  - Letters from these base words are scattered into an interactive grid/tray (e.g., 30–50 tiles).
  - Players form and submit valid words strictly matching the active target lengths using available tiles.
- **Game Modes**:
  - **Timed (Blitz / Rush)**: e.g., 90-second countdown (configurable). When a set number of words/letters are cleared (e.g. 10 words or when tile inventory drops below a threshold), the board spools new valid base words, replenishing and reshuffling the pool with dynamic refill/scramble animations. Bonus time or multiplier streaks for quick solutions!
  - **Untimed (Puzzle / Clear the Board)**: Fixed pool of letters generated from exact base word sets. The goal is complete clearance or maximizing the score before tiles run out.
- **Solo & Multiplayer Architecture**:
  - **Single Player (Solo Practice / High Score Run)**
  - **Async / Pass & Play / Ghost Duels**: Challenge other players using the exact same random seed / tile board layout.
  - **Live Head-to-Head Multiplayer**: Real-time room battle racing for the highest score or clearing the shared letter matrix fastest.

---

## 2. Decoupled Engine Architecture

To ensure high modularity, easy testing, and support for solo, async, and live multiplayer, we decouple the game logic from the UI view and the network layer.

```
src/games/scramble/ (or src/wordscramble/)
├── engine/                      # PURE GAME LOGIC (Zero React / Zero UI dependencies)
│   ├── types.ts                 # State, Actions, Board, Config interfaces
│   ├── ScrambleEngine.ts        # Pure reducer / state machine (solo & baseline rules)
│   ├── poolGenerator.ts         # Letter spooler & anagram validator
│   ├── scoring.ts               # Scoring matrix (length weight, rarity, streaks, time bonus)
│   └── seedRng.ts               # Seeded pseudo-random generator (ensures multiplayer parity)
├── storage/                     # DATA ACCESS LAYER (Repository Pattern)
│   ├── IScrambleRepository.ts   # Interface for game save/load/stats
│   ├── LocalStorageScrambleRepo.ts # Mock implementation for offline/local storage
│   └── SupabaseScrambleRepo.ts  # Production Supabase implementation
├── hooks/                       # REACT ADAPTER LAYER
│   ├── useScrambleGame.ts       # React hook wrapping ScrambleEngine
│   ├── useScrambleTimer.ts      # Precision high-resolution game timer
│   └── useScrambleAudio.ts      # Haptics and sound effects
├── components/                  # MODULAR UI LAYER
│   ├── ScrambleHeader.tsx       # Mode, timer, score, target lengths pill
│   ├── ScrambleBoard.tsx        # Grid of interactive letter tiles (drag/tap/keyboard)
│   ├── WordSubmissionTray.tsx   # Active staging word builder with backspace/clear
│   ├── FoundWordsList.tsx       # Discovered words list categorized by letter length
│   ├── ScrambleConfigModal.tsx  # Game setup modal (Letter select 3L-10L, mode, timer)
│   └── ScrambleSummaryModal.tsx # Post-game breakdown, stats, share card, replay
└── ScrambleContainer.tsx        # Top-level coordinator integrated into More Games
```

---

## 3. Game Mechanics & Spooling Algorithm

### 3.1 Letter Spooling & Board Generation
1. **Target Selection**:
   - Single Length: e.g., only `5L`.
   - Multi-Length Mix (up to 3 lengths): e.g., `[3L, 4L, 5L]` or `[4L, 6L, 8L]`.
2. **Spooling Engine**:
   - Instead of picking completely random letters (which could result in unplayable gibberish), the engine selects $N$ guaranteed valid base words matching the selected length distribution using a seeded RNG.
   - Example (5L solo, 30 tiles): Selects 6 distinct 5-letter base words = 30 letters.
   - Example (Mix [3L, 4L, 5L], 36 tiles): Selects 4x3L (12 letters), 3x4L (12 letters), 2x5L (10 letters) + 2 filler balance vowels/consonants.
   - Letter tiles are tagged with unique IDs `{ id: 'tile_1', letter: 'A', status: 'available' | 'selected' | 'consumed' }`.
   - Tiles are shuffled across the grid.
3. **Word Validation**:
   - Only words matching the chosen length(s) are valid.
   - Words must exist in the dictionary (Wordle list or TWL/Scrabble list according to user toggle).
   - Once a word is submitted, the tiles used are removed or flagged.
4. **Refill & Scramble Mechanism (Timed Mode)**:
   - When remaining available tiles drop below a threshold (or after $K$ words formed), a new batch of valid base words is spooled.
   - Remaining tiles + new tiles are smoothly rearranged with a grid shuffle transition.

---

## 4. Database Schema & Storage Layer (Supabase + LocalStorage Mock)

### 4.1 Supabase Schema (`sql_scripts/scramble_game_tables.sql`)
```sql
-- 1. Game Configurations & Definitions
CREATE TABLE public.scramble_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    seed TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('timed', 'untimed')),
    target_lengths INT[] NOT NULL,
    duration_seconds INT DEFAULT 90,
    initial_tiles JSONB NOT NULL,
    is_multiplayer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Game Sessions & Player Results (Solo & Multi)
CREATE TABLE public.scramble_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES public.scramble_games(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    score INT NOT NULL DEFAULT 0,
    words_found TEXT[] NOT NULL DEFAULT '{}',
    total_words_count INT NOT NULL DEFAULT 0,
    longest_word TEXT,
    accuracy_percentage NUMERIC(5,2),
    time_taken_seconds NUMERIC(6,2),
    completed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Live / Async Room State (For Multiplayer Battles)
CREATE TABLE public.scramble_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code TEXT UNIQUE NOT NULL,
    host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    game_config JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('lobby', 'in_progress', 'finished')),
    participants JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for leaderboards and fast lookup
CREATE INDEX idx_scramble_sessions_game_id ON public.scramble_sessions(game_id);
CREATE INDEX idx_scramble_sessions_score ON public.scramble_sessions(score DESC);
```

### 4.2 LocalStorage Mock Structure
While Supabase schema is ready for production, the repository layer will immediately support offline/LS mock saves under keys:
- `scramble_history_v1`: Array of finished sessions & word breakdowns.
- `scramble_highscores_v1`: High scores grouped by letter configuration & mode.
- `scramble_active_game_v1`: Resume active game state on refresh.

---

## 5. UI/UX & Interactive Design

1. **Selection Screen**:
   - High-fidelity letter length chips (interactive pills for 3L through 10L, with multi-select limit of 3).
   - Mode Selector: Timed (30s, 60s, 90s, 120s) vs Untimed (Clear Grid).
   - Dictionary Preference: Standard Wordle List vs Extended Scrabble/TWL List.
2. **Game Board (Glassmorphic & Dynamic)**:
   - Floating Tile Tray / Grid with smooth tactile spring animations on tap/drag.
   - Physical Keyboard input support (typing automatically selects matching available board tiles; backspace returns tiles).
   - Active Word Construction Bar with real-time length indicator and invalid/valid color pulse.
   - Shuffle Button: Reorganizes remaining tile positions on the grid without consuming extra letters.
3. **End Game Stats & Share Card**:
   - Score breakdown (Words found, Letter points, Speed bonus).
   - List of missed words that were solvable from the generated base words.
   - Visual summary card exportable for sharing.

---

## 6. Phased Implementation Roadmap

1. **Phase 1: Engine Core & Spooler**
   - Implement `ScrambleEngine.ts`, dictionary integration (3L-10L), and seeded word spooler.
   - Unit tests covering spooling, tile state transitions, and validation rules.
2. **Phase 2: Local Storage & State Adapter**
   - Implement `LocalStorageScrambleRepo.ts` conforming to `IScrambleRepository.ts`.
   - Build React context/hook `useScrambleGame.ts`.
3. **Phase 3: Interactive UI & Animations**
   - Build Grid, Tile animations, Keyboard handlers, Timer bar, and Sound/Haptics.
4. **Phase 4: Multi-length Selection & Config Modal**
   - Config modal for selecting 3L-10L (single or combination) + Timed refill dynamics.
5. **Phase 5: More Games Navigation & Persistence**
   - Register the new game in More Games drawer / switcher and persist user stats.
