import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { fetchAndSyncCloudStats, syncGameState, syncStatsFromLocalStorage, getLetterStatuses } from '../lib/game-logic';
import { supabase } from '../lib/supabaseClient';

const APP_VERSION = "1.0.4";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useAppInit = (date: string | null, loadGameState: (payload: any) => void) => {
    const { user } = useAuth();
    const [isInitializing, setIsInitializing] = useState(true);

    const checkVersionAndRefresh = async () => {
        const lastVersion = localStorage.getItem("app_version");

        if (lastVersion !== APP_VERSION) {
            console.log(`[Version Control] New version detected: ${APP_VERSION}. Cleaning...`);

            if ("serviceWorker" in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                    await reg.unregister();
                }
            }

            if ("caches" in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((key) => caches.delete(key)));
            }

            localStorage.setItem("app_version", APP_VERSION);

            const url = new URL(window.location.href);
            url.searchParams.set("v_update", APP_VERSION);
            window.location.replace(url.toString());
        }
    };

    const initializeUserStats = async (userId: string) => {
        syncStatsFromLocalStorage();
        await fetchAndSyncCloudStats(userId);
    };

    useEffect(() => {
        checkVersionAndRefresh();
    }, []);

    useEffect(() => {
        if (!date) return;

        const loadGameData = async () => {
            // Load Local
            const localRaw = localStorage.getItem(`wordle-${date}`);
            const local = localRaw ? JSON.parse(localRaw) : null;

            if (local) {
                loadGameState({
                    guesses: local.guesses || [],
                    usedHint: local.usedHint || false,
                    hintRecord: local.hintRecord || null,
                    status: local.status || 'playing',
                    gameMessage: local.gameMessage || ""
                });
            }

            // Load Cloud if user exists
            if (user?.id) {
                const { data, error } = await supabase
                    .from('scores')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('game_date', date)
                    .maybeSingle();

                if (!error && data) {
                    const cloudGuesses = data.guesses || [];
                    const localGuessesCount = local?.guesses?.length || 0;
                    const cloudIsAhead = cloudGuesses.length > localGuessesCount;
                    const cloudIsFinished = data.status !== 'playing';
                    const localIsFinished = local?.status === 'won' || local?.status === 'lost';

                    if (localIsFinished && !cloudIsFinished) {
                        syncGameState(user.id, date, local);
                    } else if (cloudIsAhead || (cloudIsFinished && !localIsFinished)) {
                        const newPayload = {
                            guesses: cloudGuesses,
                            usedHint: data.hints_used,
                            hintRecord: data.hint_record,
                            status: data.status,
                            gameMessage: data.game_message
                        };
                        loadGameState(newPayload);

                        localStorage.setItem(`wordle-${date}`, JSON.stringify({
                            ...newPayload,
                            date,
                            letterStatuses: getLetterStatuses(cloudGuesses)
                        }));
                    }
                }
                await initializeUserStats(user.id);
            }
            setIsInitializing(false);
        };

        loadGameData();
    }, [date, user, loadGameState]);

    return { isInitializing };
};
