/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { X, Loader2, Sparkles, ChevronDown, ChevronUp, Bot, Target, Lightbulb, Swords, Trophy } from 'lucide-react';
import { analyzeGame, type GameAnalysisResult, type MoveAnalysis } from '../logic/gameAnalysisLogic';
import { getTileSizeClass } from '../types';
import { applyTheme } from '../../../utils/theme';
import formatUsername from '@/utils/formatUsername';

interface GameAnalysisModalProps {
  guesses: any[];
  targetWord: string;
  onClose: () => void;
  username?: string;
  hintsUsed?: boolean;
  hintRecord?: any;
}

export const GameAnalysisModal: React.FC<GameAnalysisModalProps> = ({
  guesses,
  targetWord,
  onClose,
  username = 'Player',
  hintsUsed,
  hintRecord,
}) => {
  const [analysis, setAnalysis] = useState<GameAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTurn, setExpandedTurn] = useState<number | null>(1);

  // Sync PWA status bar & document theme when modal opens
  useEffect(() => {
    applyTheme('#111827');
    return () => {
      applyTheme('#111827');
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    analyzeGame(guesses, targetWord, { hintsUsed, hintRecord })
      .then((res) => {
        if (isMounted) {
          setAnalysis(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error running game analysis:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [guesses, targetWord, hintsUsed, hintRecord]);

  return (
    <div
      className="fixed inset-0 z-100 bg-black/90 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200 overflow-hidden"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 w-full max-w-xl rounded-2xl p-6 sm:p-6 shadow-2xl relative h-full flex flex-col flex-1 min-h-0 overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 p-3 pt-7 mt-7 mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">♟️</span>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                Game Analysis
              </h2>
              <p className="text-xs font-bold text-white opacity-90">
                Objective Move Scrutiny for {formatUsername(username)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer"
            title="Close analysis"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 min-h-0 overflow-y-auto py-4 px-1 space-y-5 scrollbar-none scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-amber-400" size={36} />
              <p className="text-sm font-black text-white uppercase tracking-widest animate-pulse">
                Simulating Bot match & analyzing moves...
              </p>
            </div>
          ) : !analysis ? (
            <div className="py-16 text-center text-white text-xs font-bold italic">
              Unable to analyze game. Please try again.
            </div>
          ) : (
            <>
              {/* Top Accuracy & Grade Dashboard */}
              <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-4">
                  {/* Accuracy Gauge Ring */}
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-gray-800"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-amber-400 transition-all duration-1000 ease-out"
                        strokeDasharray={`${analysis.accuracyScore}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="text-[14px] sm:text-lg font-black text-white block leading-none">
                        {analysis.accuracyScore}%
                      </span>
                      <span className="text-[7px] sm:text-[9px] font-bold text-white uppercase tracking-wider block mt-0.5">
                        Efficiency
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest block">
                      Performance Grade
                    </span>
                    <h3 className="text-base sm:text-xl font-black text-white tracking-wide mt-0.5">
                      {analysis.gradeTitle}
                    </h3>
                    <p className="text-xs font-bold text-white mt-1">
                      Target Word:{' '}
                      <span className="font-mono font-black text-emerald-400 uppercase">
                        {analysis.targetWord}
                      </span>{' '}
                      ({analysis.isWin ? `${guesses.length}/6 Solved` : 'Failed'})
                    </p>
                  </div>
                </div>

                {/* Move Type Counts Pill Matrix */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 w-full sm:w-auto text-xs font-black">
                  {analysis.hintsUsed && (
                    <span
                      className={`px-2.5 py-1 rounded-xl text-center flex items-center justify-center gap-1 col-span-2 ${analysis.hintQuality === 'strategic'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : analysis.hintQuality === 'tactical'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : analysis.hintQuality === 'unnecessary'
                            ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                            : 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                        }`}
                    >
                      <Lightbulb size={12} className="shrink-0" />
                      <span>
                        {analysis.hintQuality === 'strategic'
                          ? 'Strategic Hint (0% Penalty)'
                          : analysis.hintQuality === 'tactical'
                            ? 'Tactical Hint (-4%)'
                            : analysis.hintQuality === 'unnecessary'
                              ? 'Unnecessary Hint (-12%)'
                              : 'Suboptimal Hint (-15%)'}
                      </span>
                    </span>
                  )}
                  {analysis.moveCounts.brilliant > 0 && (
                    <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-xl text-center">
                      !! {analysis.moveCounts.brilliant} Brilliant
                    </span>
                  )}
                  {analysis.moveCounts.great > 0 && (
                    <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-xl text-center">
                      ! {analysis.moveCounts.great} Great
                    </span>
                  )}
                  {analysis.moveCounts.good > 0 && (
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-center">
                      ✓ {analysis.moveCounts.good} Good
                    </span>
                  )}
                  {analysis.moveCounts.lucky > 0 && (
                    <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-center">
                      🍀 {analysis.moveCounts.lucky} Lucky
                    </span>
                  )}
                  {analysis.moveCounts.suboptimal > 0 && (
                    <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-center">
                      ?! {analysis.moveCounts.suboptimal} Suboptimal
                    </span>
                  )}
                  {analysis.moveCounts.blunder > 0 && (
                    <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-xl text-center">
                      ?? {analysis.moveCounts.blunder} Blunder
                    </span>
                  )}
                </div>
              </div>

              {/* PLAYER VS BOT MATCH SIMULATION CARD */}
              <div className="bg-linear-to-r from-gray-950 via-indigo-950/40 to-gray-950 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <Swords size={18} className="text-amber-400" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      Player vs Bot Match Simulation
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-300 uppercase font-mono">
                    Same Starter Word
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  {/* User Skill Score */}
                  <div className="bg-black/40 border border-gray-800 rounded-xl p-3 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-black uppercase text-gray-300">You ({username})</span>
                    <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono mt-0.5">
                      {analysis.userSkillScore} <span className="text-xs font-normal text-white">pts</span>
                    </span>
                    <span className="text-[10px] font-bold text-white mt-1">
                      {guesses.length}/6 attempts {analysis.hintsUsed ? '(Hint used)' : ''}
                    </span>
                  </div>

                  {/* Bot Skill Score */}
                  <div className="bg-black/40 border border-gray-800 rounded-xl p-3 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-black uppercase text-indigo-300 flex items-center gap-1">
                      <Bot size={12} className="text-indigo-400" />
                      Bot Simulation
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-cyan-300 font-mono mt-0.5">
                      {analysis.botSkillScore} <span className="text-xs font-normal text-white">pts</span>
                    </span>
                    <span className="text-[10px] font-bold text-white mt-1">
                      {analysis.botSimulation.attempts}/6 attempts{' '}
                      {analysis.botSimulation.usedHint ? '(Hint used -100pts)' : ''}
                    </span>
                  </div>
                </div>

                {/* Outcome Banner */}
                <div className="text-center pt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-md ${analysis.matchOutcome.winner === 'user'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : analysis.matchOutcome.winner === 'bot'
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        : 'bg-gray-800 text-white border-gray-700'
                      }`}
                  >
                    <Trophy size={14} className="shrink-0" />
                    <span>{analysis.matchOutcome.text}</span>
                  </span>
                </div>

                {/* Bot Played Line */}
                <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 text-[11px] font-mono flex flex-wrap items-center justify-center gap-1.5 text-gray-200">
                  <span className="text-indigo-400 font-bold text-[10px] uppercase font-sans">Bot Line:</span>
                  {analysis.botSimulation.botLineWords.map((word, idx) => (
                    <React.Fragment key={idx}>
                      <span
                        className={`font-black tracking-wider px-1.5 py-0.5 rounded ${idx === 0
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : word === analysis.targetWord
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-white/10 text-white'
                          }`}
                      >
                        {word}
                      </span>
                      {idx < analysis.botSimulation.botLineWords.length - 1 && (
                        <span className="text-gray-500">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Step-by-Step Move Analysis */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-white px-1">
                  Move-by-Move Breakdown
                </h4>

                {analysis.moves.map((move: MoveAnalysis) => {
                  const isExpanded = expandedTurn === move.turn;
                  const row = guesses[move.turn - 1] || [];

                  return (
                    <div
                      key={move.turn}
                      className="bg-gray-950 border border-gray-800 rounded-2xl transition-all duration-200"
                    >
                      {/* Accordion Header */}
                      <button
                        onClick={() => setExpandedTurn(isExpanded ? null : move.turn)}
                        className="w-full p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-gray-800 text-white text-xs font-black flex items-center justify-center shrink-0 border border-gray-700">
                            {move.turn}
                          </span>

                          {/* Guess Letter Tiles */}
                          <div className="flex gap-1.5">
                            {Array.isArray(row) &&
                              row.map((cell: any, idx: number) => (
                                <div
                                  key={idx}
                                  className={`flex items-center justify-center font-black uppercase shadow-inner ${getTileSizeClass(
                                    move.targetWord.length
                                  )} ${cell.status === 'correct'
                                    ? 'bg-correct text-white'
                                    : cell.status === 'present'
                                      ? 'bg-present text-white'
                                      : 'bg-gray-800 text-white border border-gray-700'
                                    } `}
                                >
                                  {cell.letter}
                                </div>
                              ))}
                          </div>

                          {/* Classification Tag */}
                          <span
                            className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${move.classificationColor}`}
                          >
                            {move.classification}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-sm font-mono font-black text-amber-400 block">
                              {Number(move.moveRating).toFixed(2)}/10
                            </span>
                            <span className="text-[10px] font-bold text-white block">
                              {move.agreementScore}% Agreement
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp size={18} className="text-white" />
                          ) : (
                            <ChevronDown size={18} className="text-white" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Move Details */}
                      {isExpanded && (
                        <div className="p-4 border-t border-gray-800 bg-gray-900/80 space-y-4 text-xs animate-in slide-in-from-top-1 duration-200">
                          {/* Pool Reduction Metric */}
                          <div className="flex items-center justify-between bg-black/50 p-3 rounded-xl border border-gray-800 text-xs">
                            <span className="text-white font-bold">Candidate Pool:</span>
                            <div className="flex items-center gap-2 font-mono font-black">
                              <span className="text-white">{move.poolBeforeCount}</span>
                              <span className="text-white opacity-60">→</span>
                              <span className="text-emerald-400">{move.poolAfterCount}</span>
                              <span className="text-amber-400 font-bold ml-1">
                                ({move.eliminationPercentage}% eliminated)
                              </span>
                            </div>
                          </div>

                          {/* Scrutiny Reason */}
                          <div className="flex items-start gap-2.5 text-white">
                            <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
                            <p className="leading-relaxed text-xs font-bold">
                              {move.scrutinyReason}
                            </p>
                          </div>

                          {/* Strategic Hint Notice */}
                          {move.isHintRow && move.hintAnalysisNotice && (
                            <div
                              className={`flex items-center gap-2 text-xs font-black p-3 rounded-xl border ${analysis.hintQuality === 'strategic'
                                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                                : analysis.hintQuality === 'tactical'
                                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                }`}
                            >
                              <Lightbulb size={16} className="shrink-0" />
                              <span>{move.hintAnalysisNotice}</span>
                            </div>
                          )}

                          {/* Bot Recommendation Comparison (Only for Round 2 onwards) */}
                          {move.turn > 1 && move.botRecommendation?.word && (
                            <div className="bg-indigo-950/50 border border-indigo-500/30 rounded-xl p-3.5 space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-black uppercase text-indigo-300">
                                <span className="flex items-center gap-1.5">
                                  <Bot size={15} className="text-indigo-400" />
                                  Bot Recommended Play
                                </span>
                                <span className="font-mono text-emerald-300 font-black text-sm tracking-wider">
                                  {move.botRecommendation.word}
                                </span>
                              </div>
                              <p className="text-xs text-white leading-relaxed font-serif italic">
                                "{move.botRecommendation.reason}"
                              </p>
                            </div>
                          )}

                          {/* Lucky Hit Notification if applicable */}
                          {move.luckBonus > 0 && (
                            <div className="flex items-center gap-2 text-xs font-black text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl">
                              <Target size={16} className="text-amber-400" />
                              <span>Luck Bonus (+{move.luckBonus} pts awarded for high level reveal!)</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
