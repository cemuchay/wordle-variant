/* eslint-disable @typescript-eslint/no-explicit-any */
import { Loader2, X, Search } from "lucide-react";
import { useEffect, useState, useMemo, useRef, memo, useContext } from "react";
import { MAX_ATTEMPTS } from "../../constants/game";
import { Z_INDEX } from "../../constants/ui";
import { useApp } from "../../context/AppContext";
import {
  calculateSkillIndex,
  deobfuscateWord,
  getDailyConfig,
  decryptGuesses,
} from "../../lib/game-logic";
import { supabase } from "../../lib/supabaseClient";
import { generateShareText } from "../../lib/share";
import { ShareButton } from "../ShareButton";
import { parseMarathonGames } from "../../utils/marathon";
import { getTileSizeClass } from "./types";
import type { GuessPreviewData } from "./types";
import { TargetWordSection } from "./TargetWordSection";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { GuessGrid } from "./GuessGrid";
import { MarathonGameList } from "./MarathonGameList";
import { ChallengeContext } from "../../context/ChallengeContext";
import { safeLocalStorage } from "../../utils/storage";

interface GuessPreviewModalProps {
  entry: any; // More flexible for challenge participants
  onClose: () => void;
  targetWord?: string;
  salt?: string;
  lengthOfWord?: number;
  myParticipation?: any;
  initialMarathonGameIndex?: number;
  yesterday?: boolean;
  isCreator?: boolean;
  isShapeshifter?: boolean;
  challenge?: any;
  initialData?: {
    guesses: any[] | null;
    hints_used?: boolean;
    skill_score?: number;
    hint_record?: any | null;
    time_taken?: number | null;
    target_words?: string[];
  };
}

const GuessPreviewModal: React.FC<GuessPreviewModalProps> = ({
  entry,
  onClose,
  targetWord,
  salt,
  lengthOfWord,
  myParticipation,
  initialMarathonGameIndex,
  yesterday,
  isCreator,
  isShapeshifter,
  challenge: challengeProp,
  initialData,
}) => {
  // Attempt to get challenge from context if not passed as prop
  const context = useContext(ChallengeContext);
  const challenge = challengeProp || context?.selectedChallenge;

  const isMarathon = lengthOfWord === 1;
  const isChallenge = !!myParticipation || !!entry.challenge_id;
  const [marathonGameIndex, setMarathonGameIndex] = useState<number>(
    initialMarathonGameIndex ?? 0,
  );
  const [showTargetWord, setShowTargetWord] = useState(false);
  const [showScoringInfo, setShowScoringInfo] = useState(false);

  const marathonGames = useMemo(() => {
    if (!isMarathon) return [];
    return parseMarathonGames(targetWord, salt);
  }, [isMarathon, targetWord, salt]);

  const [sortMode, setSortMode] = useState<"number" | "length" | "day">(() => {
    const isBotMarathon = challenge?.is_bot_marathon || entry?.challenge?.is_bot_marathon || entry?.is_bot_marathon;
    if (isBotMarathon) return "day";
    return marathonGames.length > 15 ? "length" : "number";
  });

  const marathonGamesRef = useRef<HTMLDivElement>(null);

  const activeGame = useMemo(() => {
    if (!isMarathon) return null;
    return marathonGames[marathonGameIndex] || null;
  }, [isMarathon, marathonGames, marathonGameIndex]);

  const fetchedCacheRef = useRef<Record<number, any>>({});
  const lastEntryIdRef = useRef<string | null>(null);

  const [gameData, setGameData] = useState<GuessPreviewData | null>(() => {
    if (initialData && !isMarathon) {
      return {
        guesses: initialData.guesses,
        hints_used: initialData.hints_used || false,
        skill_score: initialData.skill_score || 0,
        hint_record: initialData.hint_record || null,
        time_taken: initialData.time_taken,
        game_message: (initialData as any).game_message || (initialData as any).gameMessage || null,
        target_words: initialData.target_words || entry.target_words || [],
      };
    }
    return null;
  });

  const [loading, setLoading] = useState(!initialData || isMarathon);
  const [viewerHasFinished, setViewerHasFinished] = useState(
    yesterday || false,
  );
  const { date, profile } = useApp();

  const getTargetDate = () => {
    if (!date) return undefined;
    if (!yesterday) return date;

    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  };

  const targetDate = getTargetDate();

  // Check if viewer has finished
  useEffect(() => {
    const checkViewerStatus = async () => {
      if (yesterday) {
        setViewerHasFinished(true);
        return;
      }

      if (isMarathon) {
        const myProg = myParticipation?.marathon_progress?.find(
          (p: any) => p.game_index === marathonGameIndex,
        );
        const myFinished =
          myProg?.status === "completed" || myProg?.status === "timed_out";
        setViewerHasFinished(myFinished);
        return;
      }

      if (myParticipation) {
        const finished =
          myParticipation.status === "completed" ||
          myParticipation.status === "timed_out" ||
          myParticipation.status === "won" ||
          myParticipation.status === "lost";
        setViewerHasFinished(finished);
        return;
      }

      // Daily game
      let finished = false;
      if (profile?.id) {
        const { data } = await supabase
          .from("scores")
          .select("status")
          .eq("user_id", profile.id)
          .eq("game_date", date) // 'date' here is literal today from AppContext
          .in("status", ["won", "lost"])
          .maybeSingle();

        finished = !!data;
      }

      if (!finished && date) {
        const localState = safeLocalStorage.getItem(`wordle-${date}`);
        if (localState) {
          try {
            const parsed = JSON.parse(localState);
            finished = parsed?.status === "won" || parsed?.status === "lost";
          } catch (e) {
            // Ignore
            console.error(e)
          }
        }
      }
      setViewerHasFinished(finished);
    };

    checkViewerStatus();
  }, [
    yesterday,
    isMarathon,
    marathonGameIndex,
    myParticipation,
    profile?.id,
    targetDate,
    date,
  ]);

  useEffect(() => {
    if (lastEntryIdRef.current !== entry.id) {
      fetchedCacheRef.current = {};
      lastEntryIdRef.current = entry.id;
    }

    const loadChallengeGuesses = async () => {
      if (isMarathon && fetchedCacheRef.current[marathonGameIndex] !== undefined) {
        setGameData(fetchedCacheRef.current[marathonGameIndex]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const word = isMarathon
          ? activeGame?.word
          : (targetWord && salt ? deobfuscateWord(targetWord, salt) : "");
        const key = word + (salt || "");

        if (isMarathon) {
          const isMe = entry.user_id === myParticipation?.user_id || entry.guest_id === myParticipation?.guest_id;
          const myProg = myParticipation?.marathon_progress?.find(
            (p: any) => p.game_index === marathonGameIndex
          );
          const myFinished = myProg?.status === "completed" || myProg?.status === "timed_out";

          const prog = entry.marathon_progress?.find(
            (p: any) => p.game_index === marathonGameIndex
          );

          if (prog && (isMe || myFinished || isCreator)) {
            let guessesToUse = prog.guesses;
            let hintRecordToUse = prog.hint_record;
            let targetWordsToUse = prog.target_words;

            // If guesses are not loaded or are in encrypted string format
            if (!Array.isArray(guessesToUse) || !targetWordsToUse) {
              const { data, error } = await supabase
                .from("challenge_participants_marathon")
                .select("guesses, hint_record, target_words")
                .eq("participation_id", entry.id)
                .eq("game_index", marathonGameIndex)
                .maybeSingle();

              if (!error && data) {
                if (!Array.isArray(guessesToUse)) guessesToUse = data.guesses;
                if (!hintRecordToUse) hintRecordToUse = data.hint_record;
                targetWordsToUse = data.target_words;
              }
            }

            let activeKey = key;
            if (isShapeshifter && Array.isArray(targetWordsToUse) && targetWordsToUse.length > 0) {
              activeKey = targetWordsToUse[targetWordsToUse.length - 1] + (salt || "");
            }
            const decrypted = decryptGuesses(guessesToUse, activeKey);

            const resolvedData = {
              guesses: decrypted || [],
              hints_used: prog.hints_used || false,
              skill_score: prog.score || 0,
              hint_record: hintRecordToUse || null,
              time_taken: prog.time_taken,
              game_message: prog.game_message || null,
              target_words: targetWordsToUse || [],
            };

            fetchedCacheRef.current[marathonGameIndex] = resolvedData;
            setGameData(resolvedData);
          } else {
            fetchedCacheRef.current[marathonGameIndex] = null;
            setGameData(null);
          }
        } else {
          // Regular Challenge Mode
          const isMe = entry.user_id === myParticipation?.user_id || entry.guest_id === myParticipation?.guest_id;
          const myFinished =
            myParticipation?.status === "completed" ||
            myParticipation?.status === "timed_out" ||
            myParticipation?.status === "won" ||
            myParticipation?.status === "lost";

          if (isMe || myFinished || isCreator) {
            let guessesToUse = entry.guesses;
            let hintRecordToUse = entry.hint_record;
            let targetWordsToUse = entry.target_words;

            if (!Array.isArray(guessesToUse) || !targetWordsToUse) {
              const { data, error } = await supabase
                .from("challenge_participants")
                .select("guesses, hint_record, target_words")
                .eq("id", entry.id)
                .single();

              if (!error && data) {
                if (!Array.isArray(guessesToUse)) guessesToUse = data.guesses;
                if (!hintRecordToUse) hintRecordToUse = data.hint_record;
                targetWordsToUse = data.target_words;
              }
            }

            let activeKey = key;
            if (isShapeshifter && Array.isArray(targetWordsToUse) && targetWordsToUse.length > 0) {
              activeKey = targetWordsToUse[targetWordsToUse.length - 1] + (salt || "");
            }
            const decrypted = decryptGuesses(guessesToUse, activeKey);

            setGameData({
              guesses: decrypted || [],
              hints_used: entry.hints_used || false,
              skill_score: entry.score || 0,
              hint_record: hintRecordToUse || null,
              time_taken: entry.time_taken,
              game_message: entry.game_message || null,
              target_words: targetWordsToUse || [],
            });
          } else {
            setGameData(null);
          }
        }
      } catch (err) {
        console.error("Error fetching/decrypting guesses:", err);
      } finally {
        setLoading(false);
      }
    };

    const isChallenge = !!myParticipation || !!entry.challenge_id;
    if (isChallenge) {
      loadChallengeGuesses();
    } else {
      // Daily game flow
      if (!initialData) {
        const fetchGuesses = async () => {
          setLoading(true);
          try {
            const { data: edgeRes, error } = await supabase.functions.invoke("redis-cache", {
              body: { action: "get-user-score", userId: entry.user_id, date: targetDate },
            });
            if (edgeRes && edgeRes.data) {
              setGameData(edgeRes.data);
            } else if (error) {
              console.error("Failed to fetch guesses from redis-cache:", error);
            }
          } catch (err) {
            console.error("Error invoking redis-cache for guesses:", err);
          } finally {
            setLoading(false);
          }
        };
        fetchGuesses();
      }
    }
  }, [
    targetDate,
    entry.id,
    entry.user_id,
    entry.guest_id,
    entry.guesses,
    entry.hint_record,
    entry.hints_used,
    entry.score,
    entry.time_taken,
    entry.game_message,
    entry.marathon_progress,
    entry.target_words,
    entry.challenge_id,
    initialData,
    marathonGameIndex,
    isMarathon,
    activeGame,
    targetWord,
    salt,
    myParticipation,
    isCreator,
    isShapeshifter,
  ]);

  const [targetWordToUse, setTargetWordToUse] = useState("");

  useEffect(() => {
    (async () => {
      let wordToUse = targetWord || (await getDailyConfig(!!profile, targetDate)).word;

      if (isMarathon && targetWord) {
        try {
          wordToUse = activeGame ? activeGame.word : "";
        } catch (e) {
          console.error("Failed to parse targetWord in marathon preview", e);
        }
      } else if (targetWord && salt) {
        wordToUse = deobfuscateWord(targetWord, salt);
      }

      setTargetWordToUse(wordToUse);
    })();
  }, [targetWord, profile, targetDate, isMarathon, activeGame, salt]);

  const fakeGrid = useMemo(() => {
    const cols = 2;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const rows = 5;
    const grid = [];
    for (let r = 0; r < rows; r++) {
      const rowLetters = [];
      for (let c = 0; c < cols; c++) {
        // eslint-disable-next-line react-hooks/purity
        rowLetters.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
      }
      grid.push(rowLetters);
    }
    return grid;
  }, []);

  const breakdown = calculateSkillIndex({
    attempts: gameData?.guesses?.length || 0,
    maxAttempts: MAX_ATTEMPTS,
    guesses: gameData?.guesses || [],
    usedHint: gameData?.hint_record !== null,
    hintRecord: gameData?.hint_record || null,
  });

  const challengeShortId = useMemo(() => {
    if (!isChallenge) return "";
    const id = entry.challenge_id || challenge?.id || "";
    return id.length > 8 ? id.slice(0, 8) : id;
  }, [isChallenge, entry.challenge_id, challenge]);

  const shareText = useMemo(() => {
    if (!gameData?.guesses || !isChallenge) return "";
    const won = gameData.guesses[gameData.guesses.length - 1]?.every(
      (r: any) => r.status === "correct",
    ) ?? false;
    const text = generateShareText({
      date: date || "",
      guesses: gameData.guesses,
      maxAttempts: MAX_ATTEMPTS,
      won,
      usedHint: gameData.hint_record !== null,
      gameMessage: "",
      wordLength: targetWordToUse.length,
    });
    if (isMarathon) {
      return text.replace(
        /^Variant - .+\n/,
        `Challenge - Marathon #${marathonGameIndex + 1} (${date})\n`,
      );
    }
    return text.replace(
      /^Variant - .+\n/,
      `Challenge - #${challengeShortId} (${date})\n`,
    );
  }, [gameData, isChallenge, isMarathon, marathonGameIndex, date, challengeShortId, targetWordToUse]);

  const isOwnEntry = profile?.id === entry.user_id || (!profile && !!entry.guest_id);
  const username = entry.username || entry.profiles?.username || "Player";
  const canSeeDetails = viewerHasFinished || isCreator || isOwnEntry;
  const revealTargetWord = viewerHasFinished || isCreator;

  useEffect(() => {
    let active = true;
    if (revealTargetWord) {
      setTimeout(() => {
        if (active) {
          setShowTargetWord(true);
        }
      }, 0);
    }
    return () => {
      active = false;
    };
  }, [revealTargetWord]);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pt-[calc(1.5rem+env(safe-area-inset-top,0))] pb-[calc(2.5rem+env(safe-area-inset-bottom,0))]"
      style={{ zIndex: Z_INDEX.GUESS_PREVIEW }}
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 w-full max-sm:w-full sm:max-w-sm rounded-2xl p-6 pb-[calc(2rem+env(safe-area-inset-bottom,0))] shadow-2xl relative flex flex-col overflow-y-auto max-h-[calc(100dvh-4rem-env(safe-area-inset-top,0)-env(safe-area-inset-bottom,0))]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white z-20"
        >
          <X size={20} />
        </button>

        <div className="flex items-center justify-center gap-2 mb-2 relative">
          <p className="text-sm uppercase tracking-tighter text-gray-100 font-bold">
            {username}'s Guesses
          </p>
          {isMarathon && (
            <button
              onClick={() => marathonGamesRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
              title="Scroll to game list"
            >
              <Search size={14} />
            </button>
          )}
        </div>


        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-correct" size={24} />
          </div>
        ) : !canSeeDetails ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Easter Egg Message */}
            <div className="my-6 px-4 py-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-center flex flex-col items-center gap-2">
              <span className="text-2xl animate-bounce">👉</span>
              <p className="text-xs font-black uppercase text-indigo-300 tracking-tight leading-relaxed">
                You tryna be sleek, watin you wan see? Play your own first
              </p>
            </div>

            {/* Fake Gibberish Grid */}
            <div className="grid gap-3 mb-6 justify-center">
              {fakeGrid.map((row, i) => (
                <div
                  key={i}
                  className="flex gap-1 p-2 bg-white/5 rounded-xl border border-white/5 opacity-60"
                >
                  {row.map((letter, j) => {
                    const status = (i + j) % 3 === 0 ? "correct" : (i + j) % 3 === 1 ? "present" : "absent";
                    return (
                      <div
                        key={j}
                        className={`flex items-center justify-center font-black uppercase shadow-inner ${getTileSizeClass(targetWordToUse.length)} ${status === "correct"
                          ? "bg-correct text-white"
                          : status === "present"
                            ? "bg-present text-white"
                            : "bg-gray-800 text-gray-500 border border-gray-700"
                          }`}
                      >
                        {letter}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : !gameData || !gameData.guesses || gameData.guesses.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-xs text-gray-500 italic">
              No guesses recorded for this length.
            </p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <TargetWordSection
              canSeeDetails={revealTargetWord}
              showTargetWord={showTargetWord}
              setShowTargetWord={setShowTargetWord}
              isShapeshifter={!!isShapeshifter}
              gameData={gameData}
              targetWordToUse={targetWordToUse}
              challenge={challenge}
              marathonGameIndex={marathonGameIndex}
              entry={entry}
            />

            {/* Roast Message */}
            {gameData?.game_message && (
              <div className="mb-4 p-4 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-center relative overflow-hidden shadow-inner animate-in fade-in zoom-in duration-300">
                <div className="absolute top-1 left-2 text-[20px] text-indigo-500/20 font-serif select-none pointer-events-none">“</div>
                <p className="text-xs italic text-indigo-200 font-serif leading-relaxed px-4">
                  {gameData.game_message}
                </p>
                <div className="absolute bottom-0 right-2 text-[20px] text-indigo-500/20 font-serif select-none pointer-events-none">”</div>
              </div>
            )}

            <ScoreBreakdown
              breakdown={breakdown}
              gameData={gameData}
              isMarathon={isMarathon}
              marathonGameIndex={marathonGameIndex}
              activeGame={activeGame}
              canSeeDetails={canSeeDetails}
              onOpenScoringInfo={() => setShowScoringInfo(true)}
            />

            <GuessGrid
              guesses={gameData.guesses}
              breakdown={breakdown}
              canSeeDetails={canSeeDetails}
              targetWordLength={targetWordToUse.length}
            />

            {isChallenge && isOwnEntry && shareText && (
              <div className="mb-4">
                <ShareButton text={shareText} />
              </div>
            )}

            {isMarathon && (
              <MarathonGameList
                sortMode={sortMode}
                setSortMode={setSortMode}
                marathonGames={marathonGames}
                marathonGameIndex={marathonGameIndex}
                setMarathonGameIndex={setMarathonGameIndex}
                setShowTargetWord={setShowTargetWord}
                entry={entry}
                myParticipation={myParticipation}
                profile={profile}
                isCreator={!!isCreator}
                marathonGamesRef={marathonGamesRef}
                isBotMarathon={challenge?.is_bot_marathon || entry?.challenge?.is_bot_marathon || entry?.is_bot_marathon}
              />
            )}

            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        )}

        {showScoringInfo && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={() => setShowScoringInfo(false)}>
            <div className="bg-gray-950 border border-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative max-h-[80vh] overflow-y-auto flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowScoringInfo(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <h2 className="text-sm font-black uppercase tracking-wider text-indigo-400 mb-4 border-b border-gray-800 pb-2">
                Variant Skill Index Scoring System
              </h2>

              <div className="space-y-5 text-[11px] leading-relaxed text-gray-300">
                {/* Point values */}
                <div>
                  <h3 className="font-bold text-gray-200 uppercase tracking-tight text-[10px] mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-correct inline-block"></span>
                    Standard Tile Rewards
                  </h3>
                  <p className="text-gray-400 mb-2">Points awarded for first-time discovery of a letter (based on attempt row):</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-white/5 p-2 rounded-xl border border-white/5 font-mono">
                    <div>
                      <p className="text-correct font-bold border-b border-white/5 pb-1 uppercase">GREEN (CORRECT)</p>
                      <p className="pt-1">Row 1: +65</p>
                      <p>Row 2: +55</p>
                      <p>Row 3: +45</p>
                      <p>Row 4: +35</p>
                      <p>Row 5: +25</p>
                      <p>Row 6: +20</p>
                    </div>
                    <div className="border-l border-white/5 pl-2">
                      <p className="text-present font-bold border-b border-white/5 pb-1 uppercase">YELLOW (PRESENT)</p>
                      <p className="pt-1">Row 1: +50</p>
                      <p>Row 2: +40</p>
                      <p>Row 3: +30</p>
                      <p>Row 4: +20</p>
                      <p>Row 5: +15</p>
                      <p>Row 6: +10</p>
                    </div>
                  </div>
                </div>

                {/* Regression rules */}
                <div>
                  <h3 className="font-bold text-gray-200 uppercase tracking-tight text-[10px] mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"></span>
                    Tactical Regression Penalties
                  </h3>
                  <p className="text-gray-400 mb-2">Penalties applied for playing worse than previous guesses (omitting/moving solved letters):</p>
                  <div className="space-y-3">
                    <div className="bg-red-950/20 border border-red-500/15 p-2.5 rounded-xl">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-[9px] uppercase tracking-wide text-red-300">Green to Black</span>
                        <span className="font-mono text-red-400 font-bold">-15 pts</span>
                      </div>
                      <p className="text-gray-400 text-[10px]">Omitting/removing a solved Green letter from its correct spot in a later guess.</p>
                      <div className="mt-1.5 flex gap-1 items-center font-mono text-[9px]">
                        <span className="text-gray-500">Row 1:</span>
                        <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">T</span>
                        <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">O</span>
                        <span className="bg-correct text-white px-1 py-0.5 rounded">T</span>
                        <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">H</span>
                        <span className="text-gray-500 mx-1">→</span>
                        <span className="text-gray-500">Row 2:</span>
                        <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">C</span>
                        <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">L</span>
                        <span className="bg-gray-850 text-gray-600 px-1 py-0.5 rounded border border-gray-750 font-bold">O</span>
                        <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">N</span>
                        <span className="text-red-400 font-bold ml-1">(T is lost)</span>
                      </div>
                    </div>

                    <div className="bg-red-950/20 border border-red-500/15 p-2.5 rounded-xl">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-[9px] uppercase tracking-wide text-red-300">Yellow to Black</span>
                        <span className="font-mono text-red-400 font-bold">-10 pts</span>
                      </div>
                      <p className="text-gray-400 text-[10px]">Completely omitting a previously found Yellow (present) letter in a subsequent guess.</p>
                      <div className="mt-1.5 flex gap-1 items-center font-mono text-[9px]">
                        <span className="text-gray-500">Row 1:</span>
                        <span className="bg-present text-white px-1 py-0.5 rounded">A</span>
                        <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">B</span>
                        <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">U</span>
                        <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">S</span>
                        <span className="text-gray-500 mx-1">→</span>
                        <span className="text-gray-500">Row 2:</span>
                        <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">C</span>
                        <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">L</span>
                        <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">O</span>
                        <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">N</span>
                        <span className="text-red-400 font-bold ml-1">(A is missing)</span>
                      </div>
                    </div>

                    <div className="bg-red-950/20 border border-red-500/15 p-2.5 rounded-xl">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-[9px] uppercase tracking-wide text-red-300">Green to Yellow</span>
                        <span className="font-mono text-red-400 font-bold">-5 pts</span>
                      </div>
                      <p className="text-gray-400 text-[10px]">Moving a previously solved Green letter out of its correct spot into a Yellow (present) spot.</p>
                    </div>

                    <div className="bg-red-950/20 border border-red-500/15 p-2.5 rounded-xl">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-[9px] uppercase tracking-wide text-red-300">Yellow Same Spot</span>
                        <span className="font-mono text-red-400 font-bold">-5 pts</span>
                      </div>
                      <p className="text-gray-400 text-[10px]">Guessing a Yellow letter in the exact same wrong spot again, wasting a guess.</p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowScoringInfo(false)}
                className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(GuessPreviewModal);
