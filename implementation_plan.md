# Implementation Plan - Daily Bot Marathon Challenge by "Variant Bot"

Introduce a system-managed daily marathon challenge created by a system account ("Variant Bot"). Authenticated users can join and compete in daily marathon sequences (word lengths 3 to 7) throughout a full Monday–Sunday cycle. The lobby will rank players by both their daily scores and weekly cumulative totals.

## User Review Required

> [!IMPORTANT]
> **Existing Challenge Safety**:
> All normal user-created and custom challenges will continue to function exactly as before. The database default for `play_date` is `'1970-01-01' NOT NULL`, making the new unique constraint `UNIQUE (participation_id, game_index, play_date)` behave identically to the old unique constraint `UNIQUE (participation_id, game_index)` for all standard challenges. No data migrations or query disruptions will occur for existing challenges.

## Open Questions

> [!NOTE]
> We will seed a system profile in the database `profiles` table for **Variant Bot** with a static ID (`00000000-0000-0000-0000-000000000b0b`).
> the daily games for the duration of the marathon should be selected at once , on creation of the challenge by the admin, hence all challenges by the variant bot will be pre-selected at creation time, this means when a user joins a marathon, all the games for that marathon will be available to be played, just like a normal marathon challenge. but limited by the day.
> each marathon is for a week, from monday to sunday, and the user can play the games for the week, but only the games for the current day will be available to be played by the user.
> each bot marathon challenge will have a clear expiry date , sunday max

---

## Proposed Changes

### Database & Schema (Supabase)

#### [NEW] [33_bot_daily_marathon.sql](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/sql_scripts/33_bot_daily_marathon.sql)

- Alter `public.challenges` to add `is_bot_marathon BOOLEAN DEFAULT FALSE NOT NULL`.
- Alter `public.challenge_participants_marathon` to add `play_date DATE DEFAULT '1970-01-01' NOT NULL`.
- Drop constraint `challenge_participants_marathon_participation_id_game_index_key` and replace it with `UNIQUE (participation_id, game_index, play_date)`.
- Create `public.bot_marathon_daily_words` table to map daily generated obfuscated words and salts.
- Insert/seed system profile `Variant Bot` with ID `00000000-0000-0000-0000-000000000b0b`.

---

### Supabase Edge Functions

#### [NEW] [generate-daily-bot-words/index.ts](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/supabase/functions/generate-daily-bot-words/index.ts)

- Deno Edge Function executed daily at 00:00:00 Lagos Time.
- Selects 5 random words of lengths 3, 4, 5, 6, 7 from standard vocabulary banks.
- Generates a random salt, obfuscates the words, and inserts them into `bot_marathon_daily_words`.

---

### Frontend Services & Queries

#### [MODIFY] [useChallengeQueries.ts](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/hooks/queries/useChallengeQueries.ts)

- Modify standard challenge detail queries (`useChallengeDetails`) to fetch today's entry from `bot_marathon_daily_words` if the challenge has `is_bot_marathon = true`. Overwrite `challenge.target_word` and `challenge.salt` in the mapped object.
- Update `submitMarathonResult` mutation logic:
   - Add `playDate?: string` parameter to the submission function.
   - Set `play_date = playDate || '1970-01-01'` in the payload.
   - Update on-conflict targets: `.upsert(data, { onConflict: "participation_id, game_index, play_date" })`.

#### [MODIFY] [ChallengeContext.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/context/ChallengeContext.tsx)

- Expose the daily `playDate` calculation based on Nigeria/Lagos timezone.
- Pass the calculated `playDate` down in the `submitResult` callbacks when `selectedChallenge.is_bot_marathon` is active.

---

### UI Components

#### [MODIFY] [ChallengeModal.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/ChallengeModal.tsx)

- Render the active `is_bot_marathon` challenge inside a prominent, pulsing Indigo banner card at the very top of the challenge view, above the segmented lists switcher.
- Provide a high-visibility entry CTA ("Enter Weekly Event") so users can join immediately.

#### [MODIFY] [GameArea.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/layout/GameArea.tsx)

- Import `useApp` and retrieve `setIsChallengeOpen`.
- When `isGameOver` is true (the user has finished playing their regular/daily game), display a friendly indigo banner nudge directly above the game grid:
   > _"Daily Word Finished! 🏁 Try today's Variant Bot Daily Marathon challenge to keep your streak going."_
- Clicking "Play Marathon" opens the challenges modal overlay directly.

#### [MODIFY] [ChallengeLobby.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/challenge/ChallengeLobby.tsx)

- Check if `selectedChallenge.is_bot_marathon` is true.
- Display a ranking switcher in the lobby: **Weekly Leaderboard** vs **Daily Leaderboard**.
   - **Weekly**: Sums scores of all rows in the participant's `marathon_progress`.
   - **Daily**: Sums scores of rows where `play_date` is Nigerian Today.

#### [MODIFY] [AdminPage.tsx](file:///c:/Users/cemuc/Documents/WEB%20PROJECTS/wordle-variant/src/components/admin/AdminPage.tsx)

- Add a new "Bot Marathon Management" panel.
- Allows admins to trigger next week's Bot Daily Marathon creation manually (sets start date, expiration date, generates first day words, and flags the challenge).

---

## Verification Plan

### Automated Tests

- Run `npm run build` to verify frontend TypeScript integration and successful bundle output.

### Manual Verification

- Deploy database schema changes via local/staging SQL tools.
- Verify standard user-created challenges (single and marathon) still record guesses, compute scores, and sync successfully without any constraint errors.
- Test weekly bot marathon creation via the Admin portal dashboard.
- Simulate daily word rollover by manually changing the client's current date and confirming words update without overriding historical user guesses.
- Join the Bot Daily Marathon, play the sequence, and verify both daily scores and weekly accumulated score ranks calculate correctly.
