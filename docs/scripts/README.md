## Game Simulator

Located in `scripts/`. Runs headless game simulations to catch bugs without needing a browser.

### Prerequisites

```bash
npm install  # (tsx and dotenv already added as dev deps)
```

### Usage

```bash
# 1 bot game (default)
npm run sim:bot

# 3 bot games with verbose logging
npm run sim:bot -- --runs 3 --verbose

# 1 mock PvP game
npm run sim:pvp

# 5 mock PvP games with verbose
npm run sim:pvp -- --runs 5 --verbose

# 100 bot games with final report
npm run sim:stress

# Custom category
npx tsx scripts/gameSimulator.ts --mode bot --category 5_letters --runs 10
```

### Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--mode` | `-m` | `bot` or `pvp` |
| `--mock` | | Use mock channels (PvP mode only; faster, no Supabase) |
| `--category` | `-c` | Category name (default: `mixed`) |
| `--runs` | `-n` | Number of sequential games (default: 1) |
| `--seed` | | Random seed for reproducibility |
| `--verbose` | `-v` | Print per-round details |
| `--report` | | Print summary with anomaly count |

### Modes

**Bot mode** (`--mode bot`):
- Two paths: `local` (default, uses `SimEngine` in-process) and `remote` (uses real Supabase, requires `SUPABASE_SERVICE_ROLE_KEY` in `.env`)
- User + bot answers are auto-generated for all 7 rounds
- Verifies score calculation, answer count, round progression

**PvP mock mode** (`--mode pvp --mock`):
- Two `SimEngine` instances with `MockMatchClient` for event passing
- Full answer exchange between simulated P1 and P2
- Diffs state after each round to detect divergence
- Fast, deterministic, no network calls

**PvP real mode** (`--mode pvp` without `--mock`):
- Two `SimMatchClient` instances connected to actual Supabase
- Creates real match via `join_wordup_queue` RPC
- Uses Realtime channels for answer exchange
- End-to-end integration test

### Architecture

```
scripts/
  gameSimulator.ts       ← CLI entrypoint
  simEngine.ts           ← Headless game state machine (no React)
  simBotGame.ts          ← Bot game simulation flow
  simPvPGame.ts          ← Live PvP simulation flow
  simMatchClient.ts      ← Supabase channel wrapper (real Realtime)
  simMatchClient.mock.ts ← Mock channel layer (deterministic)
  simLogger.ts           ← Structured logging + state diffing
  simUtils.ts            ← Helpers (user IDs, sleep, random)
```
