/* eslint-disable @typescript-eslint/no-explicit-any */
import { Eye, Loader2, X } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { MAX_ATTEMPTS } from "../constants/game";
import { Z_INDEX } from "../constants/ui";
import { useApp } from "../context/AppContext";
import {
  calculateSkillIndex,
  deobfuscateWord,
  getDailyConfig,
  decryptGuesses,
} from "../lib/game-logic";
import { supabase } from "../lib/supabaseClient";
import { parseMarathonGames } from "../utils/marathon";

const formatTime = (seconds: number | null) => {
  if (seconds === null || seconds === undefined) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const GuessPreviewModal: React.FC<{
  entry: any; // More flexible for challenge participants
  onClose: () => void;
  targetWord?: string;
  salt?: string;
  lengthOfWord?: number;
  myParticipation?: any;
  initialMarathonGameIndex?: number;
  yesterday?: boolean;
  isCreator?: boolean;
  initialData?: {
    guesses: any[] | null;
    hints_used?: boolean;
    skill_score?: number;
    hint_record?: any | null;
    time_taken?: number | null;
  };
}> = ({
  entry,
  onClose,
  targetWord,
  salt,
  lengthOfWord,
  myParticipation,
  initialMarathonGameIndex,
  yesterday,
  isCreator,
  initialData,
}) => {
    const isMarathon = lengthOfWord === 1;
    const [marathonGameIndex, setMarathonGameIndex] = useState<number>(
      initialMarathonGameIndex ?? 0,
    );
    const [showTargetWord, setShowTargetWord] = useState(false);

    const marathonGames = useMemo(() => {
      if (!isMarathon) return [];
      return parseMarathonGames(targetWord, salt);
    }, [isMarathon, targetWord, salt]);

    const activeGame = useMemo(() => {
      if (!isMarathon) return null;
      return marathonGames[marathonGameIndex] || null;
    }, [isMarathon, marathonGames, marathonGameIndex]);

    const [gameData, setGameData] = useState<{
      guesses: any[] | null;
      hints_used: boolean;
      skill_score: number;
      hint_record: { letter: string; index: number; row?: number } | null;
      time_taken?: number | null;
      game_message?: string | null;
    } | null>(null);

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
        if (profile?.id) {
          const { data } = await supabase
            .from("scores")
            .select("status")
            .eq("user_id", profile.id)
            .eq("game_date", date) // 'date' here is literal today from AppContext
            .in("status", ["won", "lost"])
            .maybeSingle();

          setViewerHasFinished(!!data);
        }
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
      const loadChallengeGuesses = async () => {
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

              // If guesses are not loaded or are in encrypted string format
              if (!Array.isArray(guessesToUse)) {
                const { data, error } = await supabase
                  .from("challenge_participants_marathon")
                  .select("guesses, hint_record")
                  .eq("participation_id", entry.id)
                  .eq("game_index", marathonGameIndex)
                  .maybeSingle();

                if (!error && data) {
                  guessesToUse = data.guesses;
                  hintRecordToUse = data.hint_record;
                }
              }

              const decrypted = decryptGuesses(guessesToUse, key);

              setGameData({
                guesses: decrypted || [],
                hints_used: prog.hints_used || false,
                skill_score: prog.score || 0,
                hint_record: hintRecordToUse || null,
                time_taken: prog.time_taken,
                game_message: prog.game_message || null,
              });
            } else {
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

              if (!Array.isArray(guessesToUse)) {
                const { data, error } = await supabase
                  .from("challenge_participants")
                  .select("guesses, hint_record")
                  .eq("id", entry.id)
                  .single();

                if (!error && data) {
                  guessesToUse = data.guesses;
                  hintRecordToUse = data.hint_record;
                }
              }

              const decrypted = decryptGuesses(guessesToUse, key);

              setGameData({
                guesses: decrypted || [],
                hints_used: entry.hints_used || false,
                skill_score: entry.score || 0,
                hint_record: hintRecordToUse || null,
                time_taken: entry.time_taken,
                game_message: entry.game_message || null,
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
        if (initialData) {
          setGameData({
            guesses: initialData.guesses,
            hints_used: initialData.hints_used || false,
            skill_score: initialData.skill_score || 0,
            hint_record: initialData.hint_record || null,
            time_taken: initialData.time_taken,
            game_message: (initialData as any).game_message || (initialData as any).gameMessage || null,
          });
          setLoading(false);
        } else {
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
      entry.challenge_id,
      initialData,
      marathonGameIndex,
      isMarathon,
      activeGame,
      targetWord,
      salt,
      myParticipation,
      isCreator,
    ]);

    const getTargetWordToUse = () => {
      let wordToUse = targetWord || getDailyConfig(!!profile, targetDate).word;

      if (isMarathon && targetWord) {
        try {
          wordToUse = activeGame ? activeGame.word : "";
        } catch (e) {
          console.error("Failed to parse targetWord in marathon preview", e);
        }
      } else if (targetWord && salt) {
        wordToUse = deobfuscateWord(targetWord, salt);
      }

      return wordToUse;
    };

    const targetWordToUse = getTargetWordToUse();

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
    }, [targetWordToUse]);

    const breakdown = calculateSkillIndex({
      attempts: gameData?.guesses?.length || 0,
      maxAttempts: MAX_ATTEMPTS,
      guesses: gameData?.guesses || [],
      usedHint: gameData?.hint_record !== null,
      hintRecord: gameData?.hint_record || null,
    });

    const username = entry.username || entry.profiles?.username || "Player";
    const entryUserId = entry.user_id || entry.profiles?.id;
    const isMe = profile?.id === entryUserId;
    const canSeeDetails = isMe || viewerHasFinished || isCreator;

    useEffect(() => {
      if (canSeeDetails) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowTargetWord(true);
      }
    }, [canSeeDetails]);

    return (
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        style={{ zIndex: Z_INDEX.GUESS_PREVIEW }}
        onClick={onClose}
      >
        <div
          className="bg-gray-900 border border-gray-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative flex flex-col overflow-y-auto max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white z-20"
          >
            <X size={20} />
          </button>

          <p className="text-sm uppercase tracking-tighter mb-2 text-center text-gray-100 font-bold">
            {username}'s Guesses
          </p>

          {isMarathon && (
            <div className="flex justify-center flex-wrap gap-1 mb-4 border-b border-white/5 py-4 ">
              {marathonGames.map((game, idx) => {
                const prog = entry.marathon_progress?.find(
                  (p: any) => p.game_index === idx,
                );
                const targetPlayed = !!prog;

                const myProg = myParticipation?.marathon_progress?.find(
                  (p: any) => p.game_index === idx,
                );
                const viewerFinished =
                  myProg?.status === "completed" ||
                  myProg?.status === "timed_out";
                const isMe =
                  profile?.id === (entry.user_id || entry.profiles?.id);

                const canSelect =
                  isMe || (targetPlayed && viewerFinished) || isCreator;

                return (
                  <button
                    key={idx}
                    disabled={false}
                    onClick={() => {
                      setMarathonGameIndex(idx);
                      setShowTargetWord(false);
                    }}
                    className={`px-2.5 h-8 rounded-lg text-[10px] font-black transition-all ${marathonGameIndex === idx ? "bg-correct text-black scale-110 shadow-lg shadow-correct/20" : canSelect ? "bg-white/10 text-white hover:bg-white/20" : "bg-white/5 text-gray-400 hover:bg-white/10 cursor-pointer"}`}
                  >
                    #{idx + 1} ({game.wordLength}L)
                  </button>
                );
              })}
            </div>
          )}

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
                          className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-black uppercase shadow-inner ${status === "correct"
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
              {/* Target Word Section */}
              <div className="mb-6 mt-3 flex flex-col items-center">
                {!canSeeDetails ? (
                  <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-center">
                    <p className="text-[10px] font-black uppercase text-gray-500 tracking-tighter">
                      Target Word Hidden
                    </p>
                    <p className="text-[8px] font-bold text-gray-600 uppercase">
                      Complete your game to reveal
                    </p>
                  </div>
                ) : showTargetWord ? (
                  <div className="flex flex-col items-center animate-in zoom-in duration-300">
                    <span className="text-[8px] uppercase font-black text-gray-500 mb-1">
                      Target Word
                    </span>
                    <div className="flex gap-1">
                      {targetWordToUse
                        .toUpperCase()
                        .split("")
                        .map((letter, i) => (
                          <div
                            key={i}
                            className="w-7 h-7 rounded-lg bg-correct/10 border border-correct/20 flex items-center justify-center text-[10px] font-black text-correct"
                          >
                            {letter}
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowTargetWord(true)}
                    className="group flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                  >
                    <Eye
                      size={12}
                      className="text-gray-500 group-hover:text-correct transition-colors"
                    />
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-white">
                      Reveal Word
                    </span>
                  </button>
                )}
              </div>

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

              {/* Breakdown Section */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 mb-4 space-y-2">
                <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                  <span>Base Performance:</span>
                  <span className="text-gray-100">{breakdown.base}</span>
                </div>
                {/* Hint Info */}
                {gameData?.hints_used && (
                  <div className="pt-2 border-t border-gray-700/50">
                    <div className="flex justify-between text-[9px] uppercase font-bold text-yellow-500 mb-1">
                      <span>Hint Used:</span>
                      <span>{breakdown.hint}</span>
                    </div>
                    {gameData.hint_record && (
                      <div className="flex items-center gap-2 text-[8px] font-black uppercase text-gray-400 bg-yellow-500/10 p-1.5 rounded-lg border border-yellow-500/20">
                        <div className="w-5 h-5 rounded bg-yellow-500 text-black flex items-center justify-center text-[10px]">
                          {canSeeDetails ? gameData.hint_record.letter : "?"}
                        </div>
                        <span>
                          Revealed at Pos {gameData.hint_record.index + 1}
                          {gameData.hint_record.row !== undefined &&
                            ` after row ${gameData.hint_record.row}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                  <span>Precision Bonus:</span>
                  <span
                    className={
                      breakdown.bonus >= 0 ? "text-correct" : "text-red-400"
                    }
                  >
                    {breakdown.bonus > 0
                      ? `+${breakdown.bonus}`
                      : breakdown.bonus}
                  </span>
                </div>

                {gameData?.time_taken !== null &&
                  gameData?.time_taken !== undefined && (
                    <div className="flex justify-between text-[9px] uppercase font-bold text-gray-400">
                      <span>Time Taken:</span>
                      <span className="text-gray-100">
                        {formatTime(gameData.time_taken)}
                      </span>
                    </div>
                  )}

                <div className="pt-2 mt-1 border-t border-gray-700 flex justify-between text-[11px] uppercase font-black text-gray-100">
                  <span>
                    {isMarathon
                      ? `Game #${marathonGameIndex + 1} (${activeGame?.wordLength || 5}L) Score:`
                      : "Total Index:"}
                  </span>
                  <span className="text-white bg-correct px-2 rounded-full">
                    {gameData?.skill_score || 0}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 mb-6 justify-center">
                {gameData?.guesses?.map((row: any[], i) => {
                  const rowScore = breakdown.rows[i];
                  const rowDecisions = breakdown?.decisions?.[i]?.decisions;
                  if (!rowDecisions)
                    return (
                      <div>
                        <h4>Row {i + 1}</h4>
                        <p>{rowScore}</p>
                        <p>No breakdown available</p>
                      </div>
                    );
                  return (
                    <div
                      key={i}
                      className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/10"
                    >
                      <div className="flex items-center gap-3 justify-between">
                        <div className="flex gap-1">
                          {row.map((cell, j) => (
                            <div
                              key={j}
                              className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-black uppercase shadow-inner ${cell.status === "correct"
                                ? "bg-correct text-white"
                                : cell.status === "present"
                                  ? "bg-present text-white"
                                  : "bg-gray-800 text-gray-400 border border-gray-700"
                                }`}
                            >
                              {canSeeDetails ? cell.letter : ""}
                            </div>
                          ))}
                        </div>
                        <div
                          className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full ${rowScore >= 0 ? "bg-correct/20 text-correct" : "bg-red-500/20 text-red-400"}`}
                        >
                          {rowScore > 0 ? `+${rowScore}` : rowScore}
                        </div>
                      </div>

                      {rowDecisions && rowDecisions.length > 0 && (
                        <div className="grid grid-cols-1 gap-1 pt-2 border-t border-white/5">
                          {rowDecisions.map((dec: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex justify-between items-center text-[8px] font-bold uppercase tracking-tighter"
                            >
                              <span className="text-gray-500">
                                Letter{" "}
                                <span className="text-gray-300">
                                  {canSeeDetails ? dec.letter : "?"}
                                </span>
                                : {dec.status}
                              </span>
                              {dec.pointDeduction !== 0 && (
                                <span
                                  className={
                                    dec.pointDeduction > 0
                                      ? "text-correct"
                                      : "text-red-400"
                                  }
                                >
                                  {dec.pointDeduction > 0
                                    ? `+${dec.pointDeduction}`
                                    : dec.pointDeduction}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

export default GuessPreviewModal;
