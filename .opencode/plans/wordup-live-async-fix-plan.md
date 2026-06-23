# WordUp Live & Async Mode — Implementation Plan & Checklist

> **Root Cause:** Bot mode is single-source synchronous. Live/async are distributed with 3+ independent event channels (Supabase realtime, Postgres changes, local timers) all driving the same state machine with zero arbitration.

---

## Implementation Batches (in execution order)

### BATCH A — Live Mode Stability Core (fixes #1, #2, #3, #13, B2)

**Why this order:** #1 and #2 are independent but both prevent hangs/corruption. #3 depends on understanding how #1 changes reveal flow. B2 is identical code to #2 in bot mode.

---

#### Fix #1 — endGame transitions locally (CRITICAL)
**File:** `useWordUpLiveGame.ts:138-176`
**Status:** [ ] DONE

**Current code (broken):**
```ts
const endGame = useCallback(async (match: any) => {
    try {
        await wordupNetworkGate.enqueue('put', 'finalize...', () => fetchWithRetry(async () => {
            const { error } = await supabase.from("wordup_matches").update({...}).eq("id", match.id);
            if (error) throw error;
        }, 3, 1000), true);
        safeSessionStorage.setItem("wordup_completed_" + match.id, "true");
        safeLocalStorage.removeItem("wordup_active_game");
    } catch (e) {
        triggerToast("Failed to save final results...", 5000);
    }
}, [triggerToast]);
// NEVER calls onGameOver or setMatchData — relies on Postgres trigger
```

**New code:**
```ts
const endGame = useCallback(async (match: any) => {
    // Transition to gameover locally first — don't wait for Postgres trigger
    const finalMatch = {
        ...match,
        status: "completed",
        p1_answered: true,
        p2_answered: true,
        completed_at: new Date().toISOString(),
    };
    setMatchData(finalMatch);
    onGameOver(finalMatch);

    // Then persist to DB (fire-and-forget, game already transitioned)
    try {
        await wordupNetworkGate.enqueue('put', 'finalize...', () => fetchWithRetry(async () => {
            const { error } = await supabase.from("wordup_matches").update({
                status: "completed",
                p1_answers: match.p1_answers,
                p2_answers: match.p2_answers,
                p1_score: match.p1_score,
                p2_score: match.p2_score,
                p1_answered: true,
                p2_answered: true,
                completed_at: finalMatch.completed_at,
            }).eq("id", match.id);
            if (error) throw error;
        }, 3, 1000), true);
        safeSessionStorage.setItem("wordup_completed_" + match.id, "true");
        safeLocalStorage.removeItem("wordup_active_game");
    } catch (e) {
        console.error("Failed to finalize match in DB:", e);
        triggerToast("Failed to save final results. Check connection.", 5000);
    }
}, [triggerToast, setMatchData, onGameOver]);
```

**Breaking change risk: MEDIUM**
- Postgres trigger may still fire `onGameOver` via the subscription handler → **double-fire risk**
- Mitigation: Fix #9 (onGameOver guard) prevents double-fire. Apply #9 in same batch.
- The postgres subscription handler at lines 640-651 will still receive the UPDATE and may try to transition. But the match status is already "completed" in store, so `handleMatchUpdate` will be a no-op (it only acts on "active" status).

**Dependencies:** Fix #9 must be done in same batch to prevent double-fire.

**Verification:**
- [ ] Play live game to completion. Gameover screen appears immediately after last reveal, no loading hang.
- [ ] Kill Supabase connection mid-game. Gameover still transitions locally (DB save fails silently).
- [ ] Check browser console: no "Failed to finalize" errors in normal conditions.
- [ ] Verify stats/XP submitted only once (no duplicate from trigger).

---

#### Fix #2 — Stale broadcast merge: `>` → `>=`
**File:** `useWordUpLiveGame.ts:359, 364` (also `useWordUpBotGame.ts:407, 412` for B2)
**Status:** [ ] DONE

**Current code:**
```ts
if ((currentMatch.p1_answers?.length || 0) > (newMatch.p1_answers?.length || 0)) {
    mergedMatch.p1_answers = currentMatch.p1_answers;
    mergedMatch.p1_score = currentMatch.p1_score;
    mergedMatch.p1_answered = currentMatch.p1_answered;
}
if ((currentMatch.p2_answers?.length || 0) > (newMatch.p2_answers?.length || 0)) {
    mergedMatch.p2_answers = currentMatch.p2_answers;
    mergedMatch.p2_score = currentMatch.p2_score;
    mergedMatch.p2_answered = currentMatch.p2_answered;
}
```

**New code (4 characters changed: `>` → `>=`):**
```ts
if ((currentMatch.p1_answers?.length || 0) >= (newMatch.p1_answers?.length || 0)) {
    mergedMatch.p1_answers = currentMatch.p1_answers;
    mergedMatch.p1_score = currentMatch.p1_score;
    mergedMatch.p1_answered = currentMatch.p1_answered;
}
if ((currentMatch.p2_answers?.length || 0) >= (newMatch.p2_answers?.length || 0)) {
    mergedMatch.p2_answers = currentMatch.p2_answers;
    mergedMatch.p2_score = currentMatch.p2_score;
    mergedMatch.p2_answered = currentMatch.p2_answered;
}
```

**Apply same change in bot mode:** `useWordUpBotGame.ts:407, 412` — same patch (latent fix).

**Breaking change risk: LOW**
- Only changes tie-breaker when lengths are equal. Local state is always fresher, so preferring local is correct.
- No other code depends on the previous "remote wins tie" behavior.

**Verification:**
- [ ] Fast-answer live game: P1 answers, P2 answers within same ~50ms window. Reveal fires exactly once.
- [ ] Induce stale broadcast: P2 answers, P1 advances within same tick. No false reveal on new round.
- [ ] Bot game still works (B2 fix applied).

---

#### Fix #3 — Duplicate timer guard in startQuestionRound
**File:** `useWordUpLiveGame.ts:330` (startQuestionRound)
**Status:** [ ] DONE

**Current code (duplicate guard only checks timer ref + index equality):**
```ts
// Inside startQuestionRound, early in the function:
if (currentIdxRef.current === index && timerRef.current !== null) {
    console.log(`... Skipping duplicate init.`);
    return;
}
```

**New code (also checks if we already advanced past this index):**
```ts
// Inside startQuestionRound, early in the function:
if (currentIdxRef.current >= index && timerRef.current !== null) {
    console.log(`... Skipping duplicate/backwards init.`);
    return;
}
if (currentIdxRef.current > index) {
    // Already past this round — stale trigger from postgres/broadcast
    return;
}
```

**Also add guard at beginning of reveal timeout callback (line 396-416):**
```ts
roundTimeoutRef.current = window.setTimeout(async () => {
    isRevealingRef.current = false;
    roundTimeoutRef.current = null;

    // Guard: if round already advanced via postgres/broadcast, don't double-advance
    if (currentIdxRef.current > (nextIdx - 1)) {
        return;
    }

    if (nextIdx >= 7) {
        useWordUpStore.getState().setView("loading");
        endGame(mergedMatch);
    } else {
        advanceRound(mergedMatch.id, nextIdx);
    }
}, nextIdx === 6 ? 3200 : 1800);
```

**Breaking change risk: LOW**
- The `>` guard in startQuestionRound only blocks backwards/stale transitions (index lower than current).
- The reveal timeout guard only blocks if `advanceRound` already incremented the index via another path.
- Normal flow (reveal timeout fires first) is unaffected.

**Verification:**
- [ ] Play live game, watch console for "Skipping duplicate" messages.
- [ ] Simulate slow network: P2's `advance_round` broadcast arrives during reveal delay. No duplicate timers.
- [ ] Normal flow: reveal → advance → next round timer starts. No interruption.
- [ ] Bot game unaffected (B2 fix applied, no postgres/broadcast race possible).

---

#### Fix #13 — endGame DB failure doesn't leave live game stuck
**File:** `useWordUpLiveGame.ts:170-173`
**Status:** [ ] DONE — RESOLVED BY FIX #1

Since fix #1 calls `setMatchData` + `onGameOver` BEFORE the DB write, the game transitions locally regardless. The `catch` block now only shows a toast — the game is already on the gameover screen. No additional code change needed beyond fix #1.

---

### BATCH B — Async Mode Stability Core (fixes #4, #5, #6, #16, #17)

---

#### Fix #4 — Async opponent progress detection via postgres_changes
**File:** `useWordUpAsyncGame.ts` — add new subscription
**Status:** [ ] DONE

**What's missing:** The async hook has zero Supabase subscriptions. Must add a `postgres_changes` listener on the match row.

**Add these items to the hook:**
1. A `matchChannelRef` (like live hook)
2. A channel subscription effect similar to live hook's `useWordUpLiveGame.ts:634-652`

**Implementation (copy + adapt from live hook):**
```ts
// Add ref for channel
const matchChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

// Add subscription effect (after the existing isActive cleanup effect)
useEffect(() => {
    if (!isActive || !matchId) return;

    const channel = supabase
        .channel(`async-match-${matchId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'wordup_matches',
            filter: `id=eq.${matchId}`,
        }, (payload) => {
            const updated = payload.new;
            if (updated.status === 'completed') {
                console.log('[WordUp Async] Opponent completed match — transitioning to gameover');
                const store = useWordUpStore.getState();
                store.setMatchData(updated);

                // Decrypt questions if not already loaded
                if (!store.questions || store.questions.length === 0) {
                    decryptMatchQuestions(updated).then(dec => {
                        store.setQuestions(dec);
                    }).catch(() => {});
                }

                onGameOver(updated);
            } else if (updated.status === 'active' && !useWordUpStore.getState().matchData?.status) {
                // Match was updated with opponent progress
                useWordUpStore.getState().setMatchData(updated);
            }
        })
        .subscribe((status) => {
            if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                console.warn('[WordUp Async] Channel closed/error:', status);
            }
        });

    matchChannelRef.current = channel;

    return () => {
        supabase.removeChannel(channel);
        matchChannelRef.current = null;
    };
}, [isActive, matchId, onGameOver, triggerToast]);
```

**Breaking change risk: MEDIUM**
- This subscription adds realtime capability to a mode designed as turn-based.
- Channel lifecycle: must ensure cleanup on unmount and when `isActive` changes.
- If opponent completes while player is in another view, the subscription fires — must check `isActive` before transitioning (already handled by effect guard).

**Verification:**
- [ ] P1 finishes async game → sees "Turn submitted" toast → exits to menu. When P2 finishes, P1 gets notification (if still in app) or sees completed match on re-entry.
- [ ] Channel cleaned up when leaving WordUp.
- [ ] No channel leaks (check Supabase dashboard).

---

#### Fix #5 — Async localStorage persistence
**File:** `useWordUpAsyncGame.ts` — add effect (after line 540)
**Status:** [ ] DONE

**Copy pattern from `useWordUpBotGame.ts:526-542`:**
```ts
useEffect(() => {
    if (!isActive || !matchId || matchData?.status === "completed") return;
    const activeState = {
        matchId,
        role: roleRef.current,
        questions,
        currentIdx,
        matchData,
        opponentStats,
        revealAnswers,
        selectedAnswer,
        timeLeft,
        maxTime,
        gameType: "async"
    };
    safeLocalStorage.setItem("wordup_active_game", JSON.stringify(activeState));
}, [isActive, matchId, questions, currentIdx, matchData, opponentStats,
    revealAnswers, selectedAnswer, timeLeft, maxTime]);
```

**Also fix live mode to include timeLeft + maxTime:** `useWordUpLiveGame.ts:483-499` — add `timeLeft, maxTime` to saved state.

**Breaking change risk: LOW**

**Verification:**
- [ ] Start async game mid-round → refresh browser → game restored at same round with same remaining time.
- [ ] Complete async game → localStorage entry removed.
- [ ] Live game refresh restores with correct remaining time.

---

#### Fix #6 — Async cross-client DB write race
**File:** `useWordUpAsyncGame.ts:369-396` (reveal timeout)
**Status:** [ ] DONE

**Fix: Re-read match row before writing to merge opponent's latest answers:**

```ts
// Before saving, re-read to get opponent's latest answers
const { data: freshMatch } = await supabase
    .from("wordup_matches").select("*").eq("id", mergedMatch.id).single();

const saveMatch = { ...mergedMatch };
if (freshMatch) {
    if (isP1) {
        saveMatch.p2_answers = freshMatch.p2_answers || saveMatch.p2_answers;
        saveMatch.p2_score = freshMatch.p2_score ?? saveMatch.p2_score;
    } else {
        saveMatch.p1_answers = freshMatch.p1_answers || saveMatch.p1_answers;
        saveMatch.p1_score = freshMatch.p1_score ?? saveMatch.p1_score;
    }
}

await supabase.from("wordup_matches")
    .update({
        p1_answers: saveMatch.p1_answers,
        p2_answers: saveMatch.p2_answers,
        p1_score: saveMatch.p1_score,
        p2_score: saveMatch.p2_score,
        p1_answered: isP1 ? true : saveMatch.p1_answered,
        p2_answered: !isP1 ? true : saveMatch.p2_answered,
    })
    .eq("id", mergedMatch.id);
```

**Breaking change risk: LOW**
- Re-reading before write adds one extra DB query per async finish.
- The merge logic preserves opponent's answers if they finished first.

**Verification:**
- [ ] P1 finishes, P2 finishes after. Both scores correctly saved.
- [ ] Both finish simultaneously. Both scores preserved.
- [ ] No overwritten answers in DB after concurrent completion.

---

#### Fix #16 — Async completed/expired guard in loadAndSubscribeMatch
**File:** `useWordUpAsyncGame.ts:426-432`
**Status:** [ ] DONE

**Copy from `useWordUpLiveGame.ts:527-557`. Add after `match` is loaded (line 448) but before processing questions:**

```ts
// Guard 1: Already completed
if (match.status === "completed" || safeSessionStorage.getItem("wordup_completed_" + match.id) === "true") {
    console.log("[WordUp Async] Match already completed, skipping.");
    triggerToast("This match is already completed.", 3000);
    useWordUpStore.getState().resetGame();
    useWordUpStore.getState().setView("menu");
    return null;
}

// Guard 2: Expired (>5 min old, not active/completed)
const matchAge = Date.now() - new Date(match.created_at).getTime();
if (matchAge > 5 * 60 * 1000 && match.status !== "completed" && match.status !== "active") {
    supabase.from("wordup_matches").update({
        status: "completed",
        completed_at: new Date().toISOString(),
    }).eq("id", match.id).then(() => {});
    triggerToast("This match has expired.", 3000);
    useWordUpStore.getState().resetGame();
    useWordUpStore.getState().setView("menu");
    return null;
}
```

**Breaking change risk: LOW**

**Verification:**
- [ ] Completed async match can't be re-opened.
- [ ] Expired matches show expiry message.
- [ ] Active/pending matches load normally.

---

#### Fix #17 — Stale closure in setTimeout: use matchDataRef instead of mergedMatch
**File:** `useWordUpAsyncGame.ts:357-404`, `useWordUpLiveGame.ts:396-416`, `useWordUpBotGame.ts:442-462`
**Status:** [ ] DONE

**Current code (all three hooks):**
```ts
roundTimeoutRef.current = window.setTimeout(async () => {
    isRevealingRef.current = false;
    roundTimeoutRef.current = null;
    if (nextIdx >= 7) {
        endGame(mergedMatch);  // <-- CLOSURE CAPTURE
    } else {
        advanceRound(mergedMatch.id, nextIdx);
    }
}, nextIdx === 6 ? 3200 : 1800);
```

**New code:**
```ts
roundTimeoutRef.current = window.setTimeout(async () => {
    isRevealingRef.current = false;
    roundTimeoutRef.current = null;
    const latestMatch = matchDataRef.current;  // <-- Always fresh
    if (!latestMatch) return;
    if (nextIdx >= 7) {
        endGame(latestMatch);
    } else {
        advanceRound(latestMatch.id, nextIdx);
    }
}, nextIdx === 6 ? 3200 : 1800);
```

**Breaking change risk: LOW**
- `matchDataRef.current` is always kept in sync via `useEffect`. It reflects the latest merged state.
- Same pattern already used in timer interval and watchdog callbacks.

**Verification:**
- [ ] Last round reveal → endGame called with latest match data (correct scores).
- [ ] Mid-round reveal: if opponent's answer arrives during reveal delay, advanceRound uses correct match ID.
- [ ] Bot mode: same behavior, no regression.

---

### BATCH C — Shared Infrastructure (fixes #7, #8, #9, #11, #12)

---

#### Fix #7 — launchedMatchIdRef cleared on failure
**File:** `index.tsx:281, 295-310`
**Status:** [ ] DONE

**Add one line in catch block:**
```ts
} catch (err) {
    launchedMatchIdRef.current = null;  // <-- ADD THIS
    console.error("onMatchFound error:", err);
    triggerToast("Failed to load match questions. Aborting game.", 5000);
    // ... rest of catch
}
```

**Breaking change risk: LOW**

**Verification:**
- [ ] Load a broken match (missing questions). See error toast. Click same match again → loads again (previously silently ignored).
- [ ] Normal match found → played → gameover. Match ID still tracked correctly.
- [ ] Rematch works.

---

#### Fix #8 — Unmount protection for active games
**File:** `index.tsx:402-410`
**Status:** [ ] DONE

**Current code (destroys everything on unmount):**
```ts
useEffect(() => {
    return () => {
        cancelMatchmakingRef.current();
        cleanUpCountdown();
        resetGame();          // ALWAYS resets
        clearSafetyTimer();
    };
}, [cleanUpCountdown]);
```

**New code (conditional reset):**
```ts
useEffect(() => {
    return () => {
        cancelMatchmakingRef.current();
        cleanUpCountdown();
        clearSafetyTimer();

        // Only reset if game is not active (don't destroy in-progress matches)
        const state = useWordUpStore.getState();
        const isGameActive = (
            state.view === "battle" ||
            state.view === "countdown" ||
            state.view === "gameover"
        ) && state.matchId;

        if (!isGameActive) {
            resetGame();
        }
    };
}, [cleanUpCountdown]);
```

**Breaking change risk: MEDIUM**
- Previously: closing WordUp always reset. Now: active games survive in store.
- If user starts a new game without properly ending old one, stale state could linger. But `resetGame()` is called on new matchmaking success.
- Recovery effect (lines 170-209) already handles re-mount via localStorage.

**Verification:**
- [ ] In active battle → press "Back" → re-open WordUp → game restored.
- [ ] In gameover → unmount → re-mount → gameover still shown.
- [ ] In lobby → unmount → game reset (not active).
- [ ] Start new game → old state properly cleaned.

---

#### Fix #9 — onGameOver stale closure double-fire guard
**File:** `index.tsx:98-99`
**Status:** [ ] DONE

**Current code (stale closure):**
```ts
const onGameOver = useCallback(async (match: any) => {
    if (view === "gameover") return;  // view from closure
    setView("gameover");
    // ... rest
}, [view, role, effectiveUser, ...]);
```

**New code (store-read guard):**
```ts
const onGameOver = useCallback(async (match: any) => {
    if (useWordUpStore.getState().view === "gameover") return;  // always fresh
    setView("gameover");
    // ... rest unchanged
}, [role, effectiveUser, setView, ...]);
```

**Breaking change risk: LOW**
- Zustand's `set()` is synchronous — `getState()` returns new value immediately after `set()`.
- First call sets view to "gameover" — second call reads fresh state → returns.
- No ref management needed.

**Verification:**
- [ ] Play live game to end: onGameOver fires exactly once.
- [ ] Play bot game: same.
- [ ] Stats/XP updated once.
- [ ] Rematch flow works.

---

#### Fix #11 — Recovery flow safety timer
**File:** `index.tsx:170-209`
**Status:** [ ] DONE

**Change recovery view from `"battle"` to `"loading"` (line 189):**
```ts
setView("loading");  // was "battle"
```

Now existing safety timer at line 388-395 automatically covers recovery. After `loadAndSubscribeMatch` completes, the 100ms timeout calls `startQuestionRound` and transitions to `"battle"`.

**Breaking change risk: LOW**

**Verification:**
- [ ] Mid-game refresh → recovery shows loading → transitions to battle.
- [ ] Recovery hangs → safety timer fires, returns to menu (no blank screen).
- [ ] Normal countdown → battle unaffected.

---

#### Fix #12 — Reactive matchData effect dependencies narrowed
**File:** `index.tsx:212-219`
**Status:** [ ] DONE

**Current code (too broad deps — entire matchData object):**
```ts
useEffect(() => {
    if (matchData?.status === "active" && view === "countdown") {
        cleanUpCountdown();
        setView("battle");
        startQuestionRound(matchData, matchData.current_question_index || 0);
    }
}, [matchData?.status, view, setView, startQuestionRound, matchData, cleanUpCountdown]);
```

**New code (narrow deps + startQuestionRoundRef):**
```ts
const startQuestionRoundRef = useRef(startQuestionRound);
useEffect(() => {
    startQuestionRoundRef.current = startQuestionRound;
}, [startQuestionRound]);

useEffect(() => {
    if (matchData?.status === "active" && view === "countdown") {
        cleanUpCountdown();
        setView("battle");
        const idx = useWordUpStore.getState().matchData?.current_question_index || 0;
        startQuestionRoundRef.current(matchData, idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [matchData?.status, view, cleanUpCountdown, setView]);
```

**Breaking change risk: LOW**
- Effect now only fires on `status` + `view` changes, not on every `matchData` field change.

**Verification:**
- [ ] Live PvP: P2 sees countdown → game_active → battle → round starts.
- [ ] No duplicate `startQuestionRound` calls during countdown.

---

### BATCH D — Tier 2 Remaining (fixes #10, #14, #15, B1, B3)

---

#### Fix #10 — CategorySelectModal stale startMatchmaking
**File:** `CategorySelectModal.tsx:248-251`
**Status:** [ ] DONE

**Fix: Read category from store:**
```ts
const handleSelectAndPlay = () => {
    const currentCategory = useWordUpStore.getState().category;
    recordRecent(currentCategory);
    onClose();
    startMatchmaking();
};
```

**Breaking change risk: LOW**

**Verification:**
- [ ] Select different category in modal → click "Play Mode" → matchmaking starts with new category.

---

#### Fix #14 — Supabase channel reconnection handling
**File:** `useWordUpLiveGame.ts:634-735`
**Status:** [ ] DONE

**Add subscription status listener and reconnect reconciliation:**

```ts
channel.subscribe(async (status, err) => {
    if (status === 'SUBSCRIBED') {
        console.log('[WordUp Live] Channel subscribed');
        // On (re)connect, re-fetch match row to reconcile state
        try {
            const { data } = await supabase
                .from("wordup_matches")
                .select("*")
                .eq("id", matchId)
                .single();
            if (data) {
                handleMatchUpdate(data);
            }
        } catch (e) {
            console.warn('[WordUp Live] Failed to reconcile on reconnect:', e);
        }
    }
    if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        console.warn('[WordUp Live] Channel disconnected:', status, err);
    }
    if (status === 'CHANNEL_ERROR') {
        triggerToast("Connection lost. Attempting to reconnect...", 3000);
    }
});
```

**Breaking change risk: LOW-MEDIUM**
- Adds DB fetch on reconnect. `handleMatchUpdate` must be idempotent (fixes #2, #3 handle this).

**Verification:**
- [ ] Disconnect network → reconnect → channel re-subscribes → state reconciles.
- [ ] Normal play: no performance impact.

---

#### Fix #15 — Watchdog only forces local player
**File:** `useWordUpLiveGame.ts:743-781`
**Status:** [ ] DONE

**Current code forces BOTH p1_answered and p2_answered. New code only forces local player:**

```ts
const isP1 = roleRef.current === "player1";
if (isP1 && !forcedState.p1_answered) {
    forcedState.p1_answered = true;
    forcedState.p1_answers = [...(forcedState.p1_answers || [])];
    if (forcedState.p1_answers.length <= currentIdxRef.current) {
        forcedState.p1_answers.push({
            question_idx: currentIdxRef.current, correct: false,
            time_taken: maxTime, points: 0,
        });
    }
} else if (!isP1 && !forcedState.p2_answered) {
    forcedState.p2_answered = true;
    forcedState.p2_answers = [...(forcedState.p2_answers || [])];
    if (forcedState.p2_answers.length <= currentIdxRef.current) {
        forcedState.p2_answers.push({
            question_idx: currentIdxRef.current, correct: false,
            time_taken: maxTime, points: 0,
        });
    }
}
```

**Breaking change risk: MEDIUM**
- With only local player forced, `bothAnswered` may stay false. The watchdog should also check DB for opponent status after ~30s of `timeLeft=0` and force-advance if opponent gone.
- Add a follow-up setTimeout inside watchdog: if 30s pass after watchdog fires and opponent hasn't answered, force opponent as timed-out too.

**Verification:**
- [ ] P1 times out, P2 answers: P1 gets 0pts, P2's answer counts.
- [ ] Both time out: both watchdogs fire independently → both 0pts → round advances.
- [ ] Opponent disconnected: watchdog → wait 30s → force-advance.

---

#### Fix B1 — Bot answer timing race
**File:** `useWordUpBotGame.ts:278-283, 385-395`
**Status:** [ ] DONE

**Reset `botActionRef.current = null` at start of `startQuestionRound`:**
```ts
const startQuestionRound = useCallback((match: any, index: number) => {
    // ... guards ...
    botActionRef.current = null;  // <-- ADD: reset before user can answer
    // ... rest ...
}, [...]);
```

**In `handleAnswerSelect`, guard against null:**
```ts
let botAction = botActionRef.current;
if (!botAction && matchDataRef.current?.is_bot_match && roleRef.current === "player1") {
    botAction = { correct: Math.random() > 0.5, time_taken: 2.0 };
}
```

**Breaking change risk: LOW**

**Verification:**
- [ ] Instant answer on round start: bot answer scored correctly (not from previous round).
- [ ] Normal bot game: no regression.

---

#### Fix B3 — Stale closure in bot mode setTimeout
**Status:** [ ] DONE — COVERED BY FIX #17

Already applied to all three hooks.

---

### BATCH E — Tier 3 Polish (fixes #18–24)

---

#### Fix #18 — Normalize timer interval to 50ms
**File:** `useWordUpAsyncGame.ts:310`
**Status:** [ ] DONE

Change `30` → `50` in the setInterval call.

**Breaking change risk: NONE**

---

#### Fix #19 — setPrevIdx/setParticles in useEffect
**File:** `BattleView.tsx:103-106`
**Status:** [ ] DONE

```ts
// Remove render-time setState, replace with effect:
useEffect(() => {
    setParticles([]);
}, [currentIdx]);
```

**Breaking change risk: LOW**

---

#### Fix #20 — Score popups cleared on round transition
**File:** `BattleView.tsx:199-216`
**Status:** [ ] DONE

```ts
useEffect(() => {
    setParticles([]);
    setScorePopups([]);  // Clear stale popups
}, [currentIdx]);
```

**Breaking change risk: LOW**

---

#### Fix #21 — Rematch setTimeout stored in ref
**File:** `useWordUpLiveGame.ts:421-423`, `useWordUpBotGame.ts:467-469`
**Status:** [ ] DONE

```ts
const rematchHideRef = useRef<number | null>(null);

// In onGameOver handler:
if (rematchHideRef.current) clearTimeout(rematchHideRef.current);
rematchHideRef.current = window.setTimeout(() => {
    setShowRematchButton(false);
    rematchHideRef.current = null;
}, 120000);

// In cleanup:
if (rematchHideRef.current) clearTimeout(rematchHideRef.current);
```

**Breaking change risk: LOW**

---

#### Fix #22 — gameType defaults to null
**File:** `useWordUpGameLoop.ts:33-39`
**Status:** [ ] DONE

```ts
const gameType = !matchData
    ? null  // explicit null instead of "live"
    : matchData.game_type
        ? matchData.game_type
        : matchData.is_bot_match ? "live-bot"
        : matchData.status === "waiting" ? "async"
        : "live";
```

**Breaking change risk: VERY LOW**

---

#### Fix #23 — Duplicate toast removed from fetchPendingMatches
**File:** `LobbyView.tsx:202-203`
**Status:** [ ] DONE

Remove `triggerToast` call inside `fetchPendingMatches` loop for completed matches.

---

#### Fix #24 — handlePlayMyTurn / handleAccepted set view directly
**File:** `LobbyView.tsx:459-463`, `98-99`
**Status:** [ ] DONE

Add `useWordUpStore.getState().setView("loading")` in both handlers.

---

## Full Verification Checklist

### Live Mode (PvP)
- [ ] Matchmaking → match found → countdown → battle starts
- [ ] Both answer → reveal → advance → new round
- [ ] Score correct for both players each round
- [ ] Game over transitions immediately (no loading hang)
- [ ] Stats/XP submitted once
- [ ] Rematch flow works
- [ ] Refresh mid-game → recovery works
- [ ] Network disconnect → "Reconnecting" → recover
- [ ] Stale broadcasts don't corrupt state
- [ ] Watchdog handles timeout correctly
- [ ] Closing WordUp mid-game → re-open restores

### Async Mode
- [ ] Match creation → P1 plays → "Turn submitted" → exits
- [ ] P2 plays → completion detected → both see gameover
- [ ] Refresh mid-game → restore with correct remaining time
- [ ] Completed match can't be re-entered
- [ ] Both finish simultaneously → no data loss
- [ ] Expired matches handled gracefully
- [ ] Duplicate toast fixed

### Bot Mode
- [ ] All normal flows work (no regression from B1, B2, B3)
- [ ] Instant answer on round start doesn't use stale bot data
- [ ] Rematch flow works
- [ ] Timer interval consistent (50ms)

### General
- [ ] `npm run build` passes after each batch
- [ ] No new console errors in normal play
- [ ] Category selection → matchmaking → correct category used
- [ ] Gameover screen double-fire prevented
- [ ] Supabase channels cleaned up on unmount

---

## Batch Dependency Map

```
Batch A (#1, #2, #3, #13, B2) ← No dependencies, can start immediately
    │
    ├─> Batch B (#4, #5, #6, #16, #17) ← No dependency on A
    │       (but #1 pattern used as reference for #4)
    │
    ├─> Batch C (#7, #8, #9, #11, #12) ← #9 depends on #1 being done
    │       (onGameOver must be guarded before endGame calls it locally)
    │
    └─> Batch D (#10, #14, #15, B1, B3) ← #14 benefits from #2, #3
               │                            ← #15 benefits from #14
               │                            ← #B3 same as #17
               │
               └─> Batch E (#18–24) ← Independent, safe to do any time
```

---

## Files Changed Per Batch

| Batch | Files |
|---|---|
| A | `useWordUpLiveGame.ts`, `useWordUpBotGame.ts` (B2 only) |
| B | `useWordUpAsyncGame.ts`, `useWordUpLiveGame.ts` (#5 bonus) |
| C | `index.tsx` |
| D | `CategorySelectModal.tsx`, `useWordUpLiveGame.ts`, `useWordUpBotGame.ts` |
| E | `BattleView.tsx`, `LobbyView.tsx`, `useWordUpAsyncGame.ts`, `useWordUpGameLoop.ts`, `useWordUpLiveGame.ts`, `useWordUpBotGame.ts` |
