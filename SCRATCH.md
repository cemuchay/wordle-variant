# Pull Request: Chat, WordGrid Notifications, Marathon Schema & Title Badge Improvements

## 📋 Summary of Changes

This PR resolves several UI, real-time sync, and notification issues across the chat module, WordGrid PvP, page title indicators, and marathon challenge database integrity.

---

### 1. 💬 FloatingChatBubble Fixes
* **Auto-Scroll Behavior on Reaction vs. New Message**:
  * Fixed an issue where adding or toggling message reactions caused the message viewport to jump unconditionally to the latest message. In-place message edits/reactions now preserve the user's scroll position.
  * Ensured newly sent messages by the current user (`isMyNewMessage`) always smoothly auto-scroll into view.
  * Added a dedicated bottom sentinel ref (`messagesEndRef`) with `double-rAF` layout rendering to guarantee the entire latest message is 100% visible with full padding.
* **Auto-Close Inactivity Timer**:
  * Increased default auto-close delay from 10s to 15s (`CLOSE_DELAY = 15000`).
  * Pauses/clears the inactivity countdown while any other user in the room is actively typing (`typingNames.length > 0`) and resumes once typing ceases.

---

### 2. 🔠 WordGrid Notifications & Username Resolution
* **Resolved "Your opponent" Sender Name Bug**:
  * Added `resolveCachedUsername(userId)` fallback when `state.players` lacks populated usernames, pulling the authenticated username/full name from session storage and formatting it with `formatUsername(...)` (e.g. `"Alex S. played a word! It is now your turn."`).
* **Prevented Duplicate Turn Notifications**:
  * Implemented deterministic, RFC 4122-compliant UUID generation (`generateDeterministicUUID`) seeded by `wordgrid_${matchId}_turn_${moveCount}`.
  * Makes turn notifications idempotent, preventing duplicate rows in `public.notifications` across queue flushes or rapid state re-renders.

---

### 3. 🌐 Dynamic Page Title Badge
* **Separated Chat Unread from Regular Notifications**:
  * Updated `usePageTitleBadge` hook to display chat message badges separately with a dedicated emoji in front:
    * Messages only: `(💬 3) Variant - Multiplayer Word Game...`
    * Notifications only: `(🔔 2) Variant - Multiplayer Word Game...`
    * Both: `(💬 3 | 🔔 2) Variant - Multiplayer Word Game...`
    * None: `Variant - Multiplayer Word Game...`

---

### 4. 🗄️ SQL Migration: Marathon Game Index Uniqueness (`138_deduplicate_and_constrain_marathon_game_index.sql`)
* **Deduplication & Integrity**:
  * Deduplicates existing entries in `challenge_participants_marathon` for matching `(participation_id, challenge_id, game_index)`, prioritizing records with `status = 'completed'`, highest score, and newest timestamp.
  * Adds `UNIQUE (participation_id, challenge_id, game_index)` constraint and covering index `idx_marathon_participation_challenge_game_idx`.

---

## 📁 Modified Files

| File | Changes |
| :--- | :--- |
| `src/components/chat/FloatingChatBubble.tsx` | Fixed reaction scroll jumps, added bottom sentinel, paused auto-close during typing, increased timer to 15s |
| `src/hooks/usePageTitleBadge.ts` | Separated chat unread counts (`💬`) from regular notification badges (`🔔`) |
| `src/lib/clientPush.ts` | Added deterministic UUID generation for turn notifications to prevent duplicate push rows |
| `src/store/useWordGridPvPStore.ts` | Fixed username resolution fallback and attached turn index to notifications |
| `sql_scripts/138_deduplicate_and_constrain_marathon_game_index.sql` | SQL script to deduplicate and enforce unique `(participation_id, challenge_id, game_index)` |

---

## 🧪 Verification
- [x] Reacting to a previous message does not jump the scroll viewport to the bottom.
- [x] Sending a message (text, voice, image) auto-scrolls smoothly to the bottom.
- [x] Inactivity timer holds open when another user is actively typing.
- [x] WordGrid turn notification displays correct sender's formatted name.
- [x] WordGrid notifications do not duplicate on move delivery.
- [x] Document title correctly reflects formatted badges.

---
---

# Pull Request: WordGrid Multi-Player Expansion, Game Creation Flow Redesign & Chat Presence Enhancements

## 📋 Summary of Changes

This update delivers a streamlined game creation experience for WordGrid, full multi-player (>2 players) match support across the engine and store, in-game player avatars, and online/last-seen presence in the floating chat bubble.

---

### 1. 🔠 WordGrid Arena: Redesigned Game Creation & Match Flow
* **Step-by-Step Creation Flow**:
  * **Step 1 (Dimensions)**: Grid size selector (`7×7` to `15×15`) dynamically determines maximum supported players (`RECOMMENDED_MAX_PLAYERS`).
  * **Step 2 (Game Mode)**: Clear toggle between **Solo vs Bot** (with AI difficulty levels) and **vs Human**.
* **Searchable Multi-Select Opponent Picker**:
  * Added live username search with clear action and scrollable user selection cards with avatars and checkboxes.
  * Dynamically enforces opponent selection limits based on chosen board dimensions (`1 to maxOpponentsAllowed`).
* **Mobile-First Layout Optimization**:
  * On mobile devices, **Your Active Matches & History** are displayed at the top (`order-1`) before match creation so players can immediately jump into their pending turns without scrolling.
  * Multi-opponent matches display overlapping avatar stacks, individual `@opponent` badge pills, player count tags (`3P`, `4P`), and multi-score breakdown.

---

### 2. 👥 Full Multi-Player (>2 Players) Engine & Store Support
* **Multi-Player Direct Challenges (`useWordGridPvPStore.ts`)**:
  * `startDirectChallenge` now queries profile records for all invited participants, generating balanced 7-tile starting racks for each player.
  * Populates and persists complete `players_data: WordGridPlayer[]` structures.
  * Sends individual push challenge notifications to all invited opponents.
* **Match History & Active Filter Queries**:
  * Updated `loadMatchesList` filter to `.or('player1_id.eq.${userId},player2_id.eq.${userId},players_data.cs.[{"id":"${userId}"}]')` so matches with 3+ players appear for all participants.
* **In-Game Score Header with Player Avatars (`WordGridContainer.tsx`)**:
  * Embedded [`ProtectedAvatar`](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/variant/wordle-variant/src/components/chat/ProtectedAvatar.tsx) directly into the score banner for each active player.
  * Added active glow indicator ring around the current turn's player avatar.

---

### 3. 💬 FloatingChatBubble: Online Presence & Keyboard Interaction
* **Online & Last Seen Status**:
  * Integrated Supabase realtime presence and `formatLastSeen` into direct message cards in the conversation list and the active conversation header.
  * Displays green glowing presence dots for online users and human-readable timestamps (`Last seen 5m ago`) for offline contacts.
* **Swipe-to-Reply Virtual Keyboard Activation**:
  * In `handleReply` and `handleSwipeToReply`, microtasks reliably focus the textarea, position the cursor, and trigger software keyboards on mobile.
  * Unified elastic swipeable containers across text, voice notes, and image messages.

---

## 📁 Modified Files

| File | Changes |
| :--- | :--- |
| `src/wordgrid/components/MatchmakingLobby.tsx` | Redesigned creation flow, searchable multi-select opponent list, mobile layout ordering, avatar stack & badges for active matches |
| `src/store/useWordGridPvPStore.ts` | Multi-player challenge initialization, `players_data` profile resolution, multi-player queries in `loadMatchesList` |
| `src/wordgrid/WordGridContainer.tsx` | Added player avatars and turn indicators to in-game score banner |
| `src/components/chat/FloatingChatBubble.tsx` | Added online/last-seen presence indicators in list & header, auto-open keyboard on swipe-to-reply |

---

## 🧪 Verification
- [x] Board dimension selection properly restricts and validates opponent multi-select limits.
- [x] Challenge launches successfully with >2 players, populating all racks and sending notifications.
- [x] In-game scores header displays avatars, usernames, and live turn glows for all participants.
- [x] Active matches on mobile appear at the top above creation menus.
- [x] Swiping right on any message opens the reply banner and focuses the input/keyboard.
- [x] Online dot and last seen text accurately reflect presence state.
- [x] Typecheck passed with 0 errors (`tsc --noEmit`).

