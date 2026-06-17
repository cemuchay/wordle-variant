/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Award, Play } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { useApp } from "../../context/AppContext";
import {
   generateWordUpQuestions,
   generateSecretKey,
   encryptQuestions,
   decryptQuestions,
   simulateBotResponse,
   getRandomBotProfile,
   BOT_PROFILES,
   type WordUpQuestion
} from "../../utils/wordupQuestionGenerator";

interface ProfileStats {
   rating: number;
   xp: number;
   games_played: number;
   games_won: number;
   games_lost: number;
   games_tied: number;
   rank_name: string;
}

const CATEGORIES = [
   { id: "mixed", name: "Quick Match (Mixed)", desc: "All question types, random word lengths" },
   { id: "3_letters", name: "3-Letter Words", desc: "Short & fast-paced challenges" },
   { id: "4_letters", name: "4-Letter Words", desc: "Standard patterns" },
   { id: "5_letters", name: "5-Letter Words", desc: "Perfect for Wordle masters" },
   { id: "6_letters", name: "6-Letter Words", desc: "Advanced length patterns" },
   { id: "7_plus", name: "7+ Letters (Diamond)", desc: "Long and complex vocabulary" }
];

export const WordUpView = () => {
   const { user } = useAuth();
   const { triggerToast } = useApp();

   // Game Views: 'menu' | 'matchmaking' | 'countdown' | 'battle' | 'gameover'
   const [view, setView] = useState<"menu" | "matchmaking" | "countdown" | "battle" | "gameover">("menu");
   const [category, setCategory] = useState("mixed");

   // Match states
   const [matchId, setMatchId] = useState<string | null>(null);
   const [role, setRole] = useState<"player1" | "player2" | null>(null);
   const [matchData, setMatchData] = useState<any>(null);

   // Gameplay questions
   const [questions, setQuestions] = useState<WordUpQuestion[]>([]);
   const [currentIdx, setCurrentIdx] = useState(0);
   const [timeLeft, setTimeLeft] = useState(10.0);
   const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
   const [revealAnswers, setRevealAnswers] = useState(false);

   // Bot state
   const [_botProfileKey, setBotProfileKey] = useState<string | null>(null);
   const botTimerRef = useRef<number | null>(null);

   // Profiles & Stats
   const [userStats, setUserStats] = useState<ProfileStats | null>(null);
   const [opponentStats, setOpponentStats] = useState<ProfileStats | null>(null);

   // Countdown states
   const [countdownText, setCountdownText] = useState("3");

   const timerRef = useRef<number | null>(null);
   const queueTimeoutRef = useRef<number | null>(null);
   const matchChannelRef = useRef<any>(null);

   // Server-local clock offset
   const clockOffset = useRef(0);

   // Fetch user's WordUp profile on mount
   useEffect(() => {
      if (user) {
         // eslint-disable-next-line react-hooks/immutability
         fetchUserProfile();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [user]);

   const fetchUserProfile = async () => {
      try {
         const { data, error } = await supabase
            .from("wordup_profiles")
            .select("*")
            .eq("id", user?.id)
            .single();

         if (error) {
            console.error("Error loading profile:", error);
         } else if (data) {
            setUserStats(data);
         }
      } catch (err) {
         console.error(err);
      }
   };

   // Sync Server Time Offset
   useEffect(() => {
      const getOffset = async () => {
         const start = Date.now();
         const { data } = await supabase.rpc("now");
         const end = Date.now();
         if (data) {
            const serverTime = new Date(data).getTime();
            const rtt = end - start;
            clockOffset.current = (serverTime - rtt / 2) - start;
         }
      };
      getOffset();
   }, []);

   // eslint-disable-next-line react-hooks/purity
   const getSyncedNow = () => Date.now() + clockOffset.current;

   // cleanup helper
   const cleanUpIntervals = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
      if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current);
   };

   useEffect(() => {
      return () => {
         cleanUpIntervals();
         if (matchChannelRef.current) {
            supabase.removeChannel(matchChannelRef.current);
         }
      };
   }, []);

   // -------------------------------------------------------------
   // Matchmaking Logic
   // -------------------------------------------------------------
   const startMatchmaking = async () => {
      if (!user) {
         window.dispatchEvent(new CustomEvent("open-auth-modal"));
         return;
      }

      setView("matchmaking");
      cleanUpIntervals();

      try {
         // Call join_wordup_queue RPC
         const { data, error } = await supabase.rpc("join_wordup_queue", {
            p_user_id: user.id,
            p_category: category
         });

         if (error) {
            triggerToast("Matchmaking error: " + error.message, 3000);
            setView("menu");
            return;
         }

         const result = typeof data === "string" ? JSON.parse(data) : data;

         if (result.status === "queued" || !result.match_id) {
            // Player 1: Queued, wait for player 2 or bot fallback
            setRole("player1");
            setMatchId(null);

            // Set 5 seconds matchmaking timeout for bot fallback
            queueTimeoutRef.current = window.setTimeout(() => {
               triggerBotFallback();
            }, 5000);

            // Listen to matches table for when player2 updates it to countdown
            subscribeToMatchmaking();
         } else {
            // Player 2: Match found! We must generate questions and key, encrypt, and push to database
            setRole("player2");
            const newMatchId = result.match_id;
            setMatchId(newMatchId);

            // Generate match details
            const rawQuestions = generateWordUpQuestions(category);
            const secretKey = generateSecretKey();
            const encryptedStr = encryptQuestions(rawQuestions, secretKey);

            // Save encrypted questions and set match to countdown
            const { error: updateError } = await supabase
               .from("wordup_matches")
               .update({
                  questions: encryptedStr,
                  encryption_key: secretKey,
                  status: "countdown",
                  question_started_at: new Date(getSyncedNow()).toISOString()
               })
               .eq("id", newMatchId);

            if (updateError) {
               console.error("Failed to setup match:", updateError);
               setView("menu");
            } else {
               // Load match
               loadAndSubscribeMatch(newMatchId);
            }
         }
      } catch (err) {
         console.error(err);
         setView("menu");
      }
   };

   // Player 1 matchmaking listener
   const subscribeToMatchmaking = () => {
      const channel = supabase
         .channel(`wordup_lobby_${user?.id}`)
         .on(
            "postgres_changes",
            {
               event: "INSERT",
               schema: "public",
               table: "wordup_matches",
               filter: `player1_id=eq.${user?.id}`
            },
            async (payload) => {
               const match = payload.new;
               if (match.status === "countdown" || match.status === "waiting") {
                  cleanUpIntervals();
                  setMatchId(match.id);
                  loadAndSubscribeMatch(match.id);
               }
            }
         )
         .on(
            "postgres_changes",
            {
               event: "UPDATE",
               schema: "public",
               table: "wordup_matches",
               filter: `player1_id=eq.${user?.id}`
            },
            async (payload) => {
               const match = payload.new;
               if (match.status === "countdown") {
                  cleanUpIntervals();
                  setMatchId(match.id);
                  loadAndSubscribeMatch(match.id);
               }
            }
         )
         .subscribe();

      matchChannelRef.current = channel;
   };

   const cancelMatchmaking = async () => {
      cleanUpIntervals();
      if (user) {
         await supabase.from("wordup_queue").delete().eq("user_id", user.id);
      }
      if (matchChannelRef.current) {
         supabase.removeChannel(matchChannelRef.current);
      }
      setView("menu");
   };

   // Bot fallback trigger
   const triggerBotFallback = async () => {
      if (!user) return;
      cleanUpIntervals();

      // Remove from queue
      await supabase.from("wordup_queue").delete().eq("user_id", user.id);

      setRole("player1");
      const botProfile = getRandomBotProfile();
      setBotProfileKey(botProfile);

      const rawQuestions = generateWordUpQuestions(category);
      const secretKey = generateSecretKey();
      const encryptedStr = encryptQuestions(rawQuestions, secretKey);

      // Create bot match row in database
      const { data, error } = await supabase
         .from("wordup_matches")
         .insert({
            category,
            player1_id: user.id,
            player2_id: null,
            is_bot_match: true,
            bot_profile: botProfile,
            questions: encryptedStr,
            encryption_key: secretKey,
            status: "countdown",
            question_started_at: new Date(getSyncedNow()).toISOString()
         })
         .select()
         .single();

      if (error) {
         console.error("Bot match insertion failed:", error);
         setView("menu");
      } else if (data) {
         setMatchId(data.id);
         loadAndSubscribeMatch(data.id);
      }
   };

   // -------------------------------------------------------------
   // Game Loop Sync
   // -------------------------------------------------------------
   const loadAndSubscribeMatch = async (mId: string) => {
      // 1. Fetch initial match state
      const { data: match, error } = await supabase
         .from("wordup_matches")
         .select("*")
         .eq("id", mId)
         .single();

      if (error || !match) {
         console.error("Error loading match:", error);
         setView("menu");
         return;
      }

      setMatchData(match);
      setBotProfileKey(match.bot_profile);

      // Decrypt questions
      if (match.questions && match.encryption_key) {
         try {
            const dec = decryptQuestions(match.questions, match.encryption_key);
            setQuestions(dec);
         } catch (e) {
            console.error("Decrypt failed:", e);
         }
      }

      // Fetch Opponent Profile if any
      const oppId = role === "player1" ? match.player2_id : match.player1_id;
      if (oppId) {
         const { data: oppProf } = await supabase
            .from("wordup_profiles")
            .select("*")
            .eq("id", oppId)
            .single();
         if (oppProf) setOpponentStats(oppProf);
      } else if (match.is_bot_match) {
         setOpponentStats({
            rating: match.bot_profile === "impossible" ? 2200 : match.bot_profile === "master" ? 1800 : 1200,
            xp: 5000,
            games_played: 150,
            games_won: 95,
            games_lost: 50,
            games_tied: 5,
            rank_name: match.bot_profile === "impossible" ? "Diamond" : "Gold"
         } as any);
      }

      // Unsubscribe from lobby channel if active
      if (matchChannelRef.current) {
         supabase.removeChannel(matchChannelRef.current);
      }

      // 2. Subscribe to this specific match channel
      const chan = supabase
         .channel(`wordup_match_${mId}`)
         .on(
            "postgres_changes",
            {
               event: "UPDATE",
               schema: "public",
               table: "wordup_matches",
               filter: `id=eq.${mId}`
            },
            (payload) => {
               handleMatchUpdate(payload.new);
            }
         )
         .subscribe();

      matchChannelRef.current = chan;

      // Start Countdown view
      setView("countdown");
      startCountdown(match);
   };

   const startCountdown = (match: any) => {
      let count = 3;
      setCountdownText("3");
      const interval = setInterval(() => {
         count--;
         if (count === 0) {
            clearInterval(interval);
            // Move to battle view
            setView("battle");
            startQuestionRound(match, 0);
         } else {
            setCountdownText(String(count));
         }
      }, 1000);
   };

   const startQuestionRound = (match: any, index: number) => {
      cleanUpIntervals();
      setCurrentIdx(index);
      setSelectedAnswer(null);
      setRevealAnswers(false);
      setTimeLeft(10.0);

      // Start realtimer countdown based on question_started_at
      const startTime = match.question_started_at
         ? new Date(match.question_started_at).getTime()
         : getSyncedNow();

      timerRef.current = window.setInterval(() => {
         const now = getSyncedNow();
         const elapsed = (now - startTime) / 1000;
         const remaining = Math.max(0, 10.0 - elapsed);

         setTimeLeft(parseFloat(remaining.toFixed(2)));

         if (remaining <= 0) {
            clearInterval(timerRef.current!);
            // Timeout user answer
            handleAnswerSelect("");
         }
      }, 50);

      // Bot Turn Simulation Trigger
      if (match.is_bot_match && role === "player1") {
         const q = questions[index];
         const botProf = match.bot_profile || "average";
         const botAction = simulateBotResponse(q, botProf);

         botTimerRef.current = window.setTimeout(async () => {
            // Update match with bot submission
            const botAnswers = [...(match.p2_answers || [])];
            botAnswers.push({
               question_idx: index,
               correct: botAction.correct,
               time_taken: botAction.time_taken,
               points: botAction.points
            });

            await supabase
               .from("wordup_matches")
               .update({
                  p2_answers: botAnswers,
                  p2_answered: true,
                  p2_score: (match.p2_score || 0) + botAction.points
               })
               .eq("id", match.id);

         }, botAction.time_taken * 1000);
      }
   };

   const handleMatchUpdate = (newMatch: any) => {
      setMatchData(newMatch);

      // Check if both players answered
      if (newMatch.p1_answered && newMatch.p2_answered && !revealAnswers) {
         // Both answered, show correct answer for 1.5s
         cleanUpIntervals();
         setRevealAnswers(true);

         setTimeout(() => {
            // Next question or end game
            const nextIdx = newMatch.current_question_index + 1;
            if (nextIdx >= 7) {
               // Game complete!
               endGame(newMatch);
            } else if (role === "player2") {
               // Only Player 2 (creator or joiner) updates round parameters to avoid double execution
               advanceRound(newMatch.id, nextIdx);
            }
         }, 1800);
      }

      // Check if question index advanced
      if (newMatch.current_question_index !== currentIdx && newMatch.status === "active") {
         startQuestionRound(newMatch, newMatch.current_question_index);
      }

      // Completed
      if (newMatch.status === "completed" && view !== "gameover") {
         setView("gameover");
         calculateFinalStats(newMatch);
      }
   };

   const advanceRound = async (mId: string, nextIdx: number) => {
      await supabase
         .from("wordup_matches")
         .update({
            current_question_index: nextIdx,
            p1_answered: false,
            p2_answered: false,
            question_started_at: new Date(getSyncedNow()).toISOString()
         })
         .eq("id", mId);
   };

   // -------------------------------------------------------------
   // Answer Submission
   // -------------------------------------------------------------
   const handleAnswerSelect = async (choice: string) => {
      if (selectedAnswer !== null || revealAnswers) return;

      setSelectedAnswer(choice);
      cleanUpIntervals();

      // Measure local elapsed time from start of round
      const elapsed = parseFloat((10.0 - timeLeft).toFixed(2));
      const q = questions[currentIdx];
      const correct = choice === q.answer;

      // Scoring: Correct = 100, speed bonus up to 50
      let points = 0;
      if (correct) {
         const speedBonus = Math.max(0, Math.round((1.0 - elapsed / 10.0) * 50));
         points = 100 + speedBonus;
      }

      const submission = {
         question_idx: currentIdx,
         correct,
         time_taken: elapsed,
         points
      };

      if (role === "player1") {
         const answers = [...(matchData.p1_answers || [])];
         answers.push(submission);

         await supabase
            .from("wordup_matches")
            .update({
               p1_answers: answers,
               p1_answered: true,
               p1_score: (matchData.p1_score || 0) + points
            })
            .eq("id", matchId!);
      } else {
         const answers = [...(matchData.p2_answers || [])];
         answers.push(submission);

         await supabase
            .from("wordup_matches")
            .update({
               p2_answers: answers,
               p2_answered: true,
               p2_score: (matchData.p2_score || 0) + points
            })
            .eq("id", matchId!);
      }
   };

   // -------------------------------------------------------------
   // GameOver & Rating calculations
   // -------------------------------------------------------------
   const endGame = async (match: any) => {
      await supabase
         .from("wordup_matches")
         .update({
            status: "completed",
            completed_at: new Date().toISOString()
         })
         .eq("id", match.id);
   };

   const calculateFinalStats = async (match: any) => {
      if (!user) return;

      const isP1 = role === "player1";
      const myScore = isP1 ? match.p1_score : match.p2_score;
      const oppScore = isP1 ? match.p2_score : match.p1_score;

      const won = myScore > oppScore;
      const tied = myScore === oppScore;

      // Calculate XP
      // +50 standard completion, +100 for win, +10 for correct answers
      const myAnswers = isP1 ? match.p1_answers : match.p2_answers;
      const correctCount = myAnswers.filter((a: any) => a.correct).length;

      const xpReward = 50 + (won ? 100 : 0) + (correctCount * 10);

      // Elo Change calculations (dynamic Elo)
      const eloGain = won ? 18 + Math.max(0, correctCount) : tied ? 2 : -12;

      // Update Database profiles
      const { data: currentProf } = await supabase
         .from("wordup_profiles")
         .select("*")
         .eq("id", user.id)
         .single();

      if (currentProf) {
         const newRating = Math.max(800, currentProf.rating + eloGain);
         const newXp = currentProf.xp + xpReward;

         // Determine Rank
         let rank = "Bronze";
         if (newXp > 3000) rank = "Master";
         else if (newXp > 1800) rank = "Diamond";
         else if (newXp > 1000) rank = "Gold";
         else if (newXp > 400) rank = "Silver";

         await supabase
            .from("wordup_profiles")
            .update({
               rating: newRating,
               xp: newXp,
               games_played: currentProf.games_played + 1,
               games_won: currentProf.games_won + (won ? 1 : 0),
               games_lost: currentProf.games_lost + (won || tied ? 0 : 1),
               games_tied: currentProf.games_tied + (tied ? 1 : 0),
               rank_name: rank
            })
            .eq("id", user.id);

         // Refresh profile states
         fetchUserProfile();
      }
   };

   const getRankColor = (rankName: string) => {
      switch (rankName) {
         case "Master": return "text-purple-400 border-purple-500/30 bg-purple-500/10";
         case "Diamond": return "text-cyan-400 border-cyan-500/30 bg-cyan-500/10";
         case "Gold": return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
         case "Silver": return "text-slate-300 border-slate-500/30 bg-slate-500/10";
         default: return "text-amber-600 border-amber-600/30 bg-amber-600/10";
      }
   };

   // -------------------------------------------------------------
   // Render Helpers
   // -------------------------------------------------------------
   const activeQuestion = questions[currentIdx];

   return (
      <div className="w-full max-w-lg mx-auto h-full flex flex-col bg-dark overflow-y-auto scrollbar-hide p-4 relative" style={{ minHeight: "100%" }}>
         <AnimatePresence mode="wait">
            {/* 1. LOBBY VIEW */}
            {view === "menu" && (
               <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="flex flex-col gap-6 flex-1 justify-center py-6"
               >
                  <div className="text-center space-y-2">
                     <div className="inline-flex p-4 bg-correct/10 rounded-3xl border border-correct/20 text-correct shadow-[0_0_20px_rgba(46,204,113,0.15)] animate-pulse">
                        <Swords size={32} />
                     </div>
                     <h2 className="text-2xl font-black uppercase tracking-wider text-white">WordUp Battles</h2>
                     <p className="text-xs text-gray-400 max-w-xs mx-auto">
                        Test your word speed & pattern skills in a head-to-head 7-question rapid match!
                     </p>
                  </div>

                  {userStats && (
                     <div className="grid grid-cols-3 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                        <div>
                           <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Rating</p>
                           <p className="text-lg font-black text-white">{userStats.rating} ELO</p>
                        </div>
                        <div>
                           <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Rank</p>
                           <p className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border inline-block mt-1 ${getRankColor(userStats.rank_name)}`}>
                              {userStats.rank_name}
                           </p>
                        </div>
                        <div>
                           <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Wins/Losses</p>
                           <p className="text-lg font-black text-correct">
                              {userStats.games_won}<span className="text-gray-500 text-xs">/</span><span className="text-red-400">{userStats.games_lost}</span>
                           </p>
                        </div>
                     </div>
                  )}

                  <div className="space-y-3">
                     <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Select Category</p>
                     <div className="grid grid-cols-1 gap-2">
                        {CATEGORIES.map((cat) => (
                           <button
                              key={cat.id}
                              onClick={() => setCategory(cat.id)}
                              className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${category === cat.id
                                    ? "bg-correct/10 border-correct text-white shadow-[0_0_15px_rgba(46,204,113,0.1)]"
                                    : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                                 }`}
                           >
                              <div className="flex items-center gap-2">
                                 <span className={`w-2 h-2 rounded-full ${category === cat.id ? "bg-correct" : "bg-gray-600"}`} />
                                 <p className="text-xs font-black uppercase tracking-wider text-white">{cat.name}</p>
                              </div>
                              <p className="text-[9px] text-gray-500 mt-1">{cat.desc}</p>
                           </button>
                        ))}
                     </div>
                  </div>

                  <button
                     onClick={startMatchmaking}
                     className="w-full bg-correct hover:bg-correct/90 text-black font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2 tracking-widest shadow-[0_4px_20px_rgba(46,204,113,0.3)] cursor-pointer hover:scale-102 active:scale-98 transition-all"
                  >
                     <Play size={16} fill="black" /> Search Opponent
                  </button>
               </motion.div>
            )}

            {/* 2. MATCHMAKING SCREEN */}
            {view === "matchmaking" && (
               <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col flex-1 justify-center items-center gap-8 py-12"
               >
                  <div className="relative flex items-center justify-center">
                     <div className="w-24 h-24 rounded-full border border-correct/20 border-t-correct animate-spin" />
                     <Swords size={28} className="absolute text-correct animate-pulse" />
                  </div>

                  <div className="text-center space-y-2">
                     <h3 className="text-lg font-black uppercase tracking-wider">Finding Match</h3>
                     <p className="text-xs text-gray-500 uppercase font-black tracking-wide">
                        Category: {CATEGORIES.find(c => c.id === category)?.name}
                     </p>
                     <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mt-4">
                        Bot joins in 5 seconds...
                     </p>
                  </div>

                  <button
                     onClick={cancelMatchmaking}
                     className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                  >
                     Cancel
                  </button>
               </motion.div>
            )}

            {/* 3. 3-SECOND COUNTDOWN */}
            {view === "countdown" && (
               <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.5, opacity: 0 }}
                  className="flex flex-col flex-1 justify-center items-center py-24"
               >
                  <h3 className="text-xs text-gray-500 font-black uppercase tracking-widest mb-6">Battle Starts In</h3>
                  <motion.h1
                     key={countdownText}
                     initial={{ scale: 0.5, opacity: 0 }}
                     animate={{ scale: 1, opacity: 1 }}
                     className="text-8xl font-black text-correct select-none font-mono"
                  >
                     {countdownText}
                  </motion.h1>
               </motion.div>
            )}

            {/* 4. ACTIVE BATTLE VIEW */}
            {view === "battle" && activeQuestion && (
               <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col flex-1 justify-between h-full py-2"
               >
                  {/* Players Panel */}
                  <div className="grid grid-cols-2 gap-4 bg-white/5 border border-white/10 p-3 rounded-2xl shrink-0">
                     <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-correct/20 border border-correct/30 flex items-center justify-center text-xs font-black shrink-0">
                           YOU
                        </div>
                        <div className="truncate">
                           <p className="text-[9px] text-gray-400 font-bold uppercase">You</p>
                           <p className="text-sm font-black text-white">{matchData?.p1_score || 0} pts</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 min-w-0 justify-end text-right">
                        <div className="truncate">
                           <p className="text-[9px] text-gray-400 font-bold uppercase truncate">
                              {matchData?.is_bot_match
                                 ? (BOT_PROFILES[matchData.bot_profile]?.name || "Word Bot")
                                 : (opponentStats ? "Opponent" : "Matching Bot")}
                           </p>
                           <p className="text-sm font-black text-white">{matchData?.p2_score || 0} pts</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-xs font-black shrink-0">
                           {matchData?.is_bot_match ? "🤖" : "VS"}
                        </div>
                     </div>
                  </div>

                  {/* Score Indicators / Answer Status */}
                  <div className="flex justify-between items-center px-2 py-2 shrink-0">
                     <div className="flex items-center gap-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${matchData?.p1_answered ? "bg-correct animate-pulse" : "bg-gray-700"}`} />
                        <span className="text-[9px] text-gray-500 uppercase font-black">
                           {matchData?.p1_answered ? "Submitted" : "Thinking..."}
                        </span>
                     </div>
                     <span className="text-xs font-black text-gray-400">Round {currentIdx + 1} of 7</span>
                     <div className="flex items-center gap-1 justify-end">
                        <span className="text-[9px] text-gray-500 uppercase font-black">
                           {matchData?.p2_answered ? "Submitted" : "Thinking..."}
                        </span>
                        <span className={`w-2.5 h-2.5 rounded-full ${matchData?.p2_answered ? "bg-pink-500 animate-pulse" : "bg-gray-700"}`} />
                     </div>
                  </div>

                  {/* Timer Bar */}
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden shrink-0">
                     <div
                        className={`h-full transition-all duration-75 ${timeLeft > 3 ? "bg-correct" : "bg-red-500"}`}
                        style={{ width: `${(timeLeft / 10.0) * 100}%` }}
                     />
                  </div>

                  {/* Question Container */}
                  <div className="flex-1 flex flex-col justify-center gap-6 py-6 min-h-0">
                     <div className="text-center space-y-2">
                        <p className="text-[10px] font-black uppercase text-correct tracking-widest">
                           {activeQuestion.type.replace("_", " ")}
                        </p>
                        <h2 className="text-xl font-black tracking-tight leading-relaxed text-white">
                           {activeQuestion.prompt}
                        </h2>
                        {activeQuestion.subPrompt && (
                           <p className="text-xs text-gray-400 bg-white/5 px-3 py-1 rounded-lg inline-block">
                              {activeQuestion.subPrompt}
                           </p>
                        )}
                     </div>

                     {/* Choices Grid */}
                     <div className="grid grid-cols-2 gap-3 shrink-0">
                        {activeQuestion.choices.map((choice) => {
                           const isSelected = selectedAnswer === choice;
                           const isCorrect = choice === activeQuestion.answer;

                           let btnClass = "bg-white/5 border-white/10 text-white hover:bg-white/10";
                           if (selectedAnswer !== null) {
                              if (isCorrect) {
                                 btnClass = "bg-correct/20 border-correct text-correct font-black";
                              } else if (isSelected) {
                                 btnClass = "bg-red-500/20 border-red-500 text-red-500 font-bold";
                              } else {
                                 btnClass = "bg-white/5 border-white/10 text-gray-500 opacity-60";
                              }
                           }

                           return (
                              <button
                                 key={choice}
                                 disabled={selectedAnswer !== null || revealAnswers}
                                 onClick={() => handleAnswerSelect(choice)}
                                 className={`p-4 rounded-2xl border text-center font-black uppercase tracking-wider transition-all active:scale-95 text-xs flex items-center justify-center min-h-[56px] ${selectedAnswer === null ? "cursor-pointer" : "cursor-default"
                                    } ${btnClass}`}
                              >
                                 {choice}
                              </button>
                           );
                        })}
                     </div>
                  </div>
               </motion.div>
            )}

            {/* 5. GAMEOVER SUMMARY SCREEN */}
            {view === "gameover" && matchData && (
               <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col flex-1 justify-center gap-6 py-4"
               >
                  <div className="text-center space-y-1">
                     <Award size={48} className="mx-auto text-correct animate-bounce" />
                     <h2 className="text-2xl font-black uppercase tracking-wider text-white">
                        {matchData.p1_score > matchData.p2_score ? "Victory!" : matchData.p1_score === matchData.p2_score ? "Draw!" : "Defeat"}
                     </h2>
                     <p className="text-xs text-gray-400 uppercase tracking-widest font-black">Match Completed</p>
                  </div>

                  {/* Side-by-Side Scores */}
                  <div className="grid grid-cols-2 gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                     <div>
                        <p className="text-[10px] text-gray-500 font-black uppercase">You</p>
                        <p className="text-2xl font-black text-white">{matchData.p1_score} pts</p>
                     </div>
                     <div className="border-l border-white/10">
                        <p className="text-[10px] text-gray-500 font-black uppercase">
                           {matchData.is_bot_match ? "Bot Opponent" : "Opponent"}
                        </p>
                        <p className="text-2xl font-black text-white">{matchData.p2_score} pts</p>
                     </div>
                  </div>

                  {/* Rewards and Elo changes */}
                  <div className="bg-correct/10 border border-correct/20 rounded-2xl p-4 text-center space-y-1 shadow-[0_0_15px_rgba(46,204,113,0.1)]">
                     <p className="text-xs font-bold text-correct uppercase tracking-wider">
                        Rating Change: {matchData.p1_score > matchData.p2_score ? "+18 Elo Rating" : matchData.p1_score === matchData.p2_score ? "+2 Elo" : "-12 Elo Rating"}
                     </p>
                     <p className="text-[10px] text-gray-400 uppercase font-black">
                        Earned: +{50 + (matchData.p1_score > matchData.p2_score ? 100 : 0) + (matchData.p1_answers.filter((a: any) => a.correct).length * 10)} XP
                     </p>
                  </div>

                  {/* Rematch action */}
                  <button
                     onClick={() => setView("menu")}
                     className="w-full bg-correct hover:bg-correct/90 text-black font-black uppercase py-4 rounded-xl flex items-center justify-center gap-2 tracking-widest shadow-lg cursor-pointer hover:scale-102 active:scale-98 transition-all"
                  >
                     Play Again
                  </button>
               </motion.div>
            )}
         </AnimatePresence>
      </div>
   );
};
