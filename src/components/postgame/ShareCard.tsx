import { useState, useMemo } from "react";
import { Share2, Check, Copy, Sparkles, Clock, Loader2 } from "lucide-react";
import type { GuessResult } from "../../types/game";
import { generateShareText } from "../../lib/share";
import { useApp } from "../../context/AppContext";
import { TOAST_DURATION } from "../../constants/ui";
import CountDown from "../common/CountDown";

interface ShareCardProps {
  date: string;
  guesses: GuessResult[][];
  maxAttempts: number;
  won: boolean;
  usedHint: boolean;
  gameMessage?: string;
  wordLength: number;
  hintRecord?: { index: number; letter: string; row?: number } | null;
  isAuthenticated?: boolean;
}

export const ShareCard: React.FC<ShareCardProps> = ({
  date,
  guesses,
  maxAttempts,
  won,
  usedHint,
  gameMessage = "",
  wordLength,
  hintRecord,
  isAuthenticated = false,
}) => {
  const { triggerToast } = useApp();
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Generate visual emoji grid representation
  const emojiRows = useMemo(() => {
    return guesses.map((row) =>
      row.map((cell) => {
        if (cell.status === "correct") return { char: "🟩", bg: "bg-emerald-500/80 border-emerald-400" };
        if (cell.status === "present") return { char: "🟨", bg: "bg-amber-500/80 border-amber-400" };
        return { char: "⬛", bg: "bg-slate-800 border-slate-700" };
      })
    );
  }, [guesses]);

  const shareText = useMemo(() => {
    return generateShareText({
      date,
      guesses,
      maxAttempts,
      won,
      usedHint,
      gameMessage,
      wordLength,
      isAuthenticated,
      hintRecord,
    });
  }, [date, guesses, maxAttempts, won, usedHint, gameMessage, wordLength, isAuthenticated, hintRecord]);

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Variant - ${date}`,
          text: shareText,
        });
        triggerToast("Result shared successfully!", TOAST_DURATION.DEFAULT);
        setIsSharing(false);
        return;
      } catch (err: any) {
        if (err.name === "AbortError") {
          setIsSharing(false);
          return;
        }
      }
    }

    // Fallback: Clipboard copy
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopied(true);
      triggerToast("Result copied to clipboard! 📋", TOAST_DURATION.DEFAULT);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      triggerToast("Failed to copy results", TOAST_DURATION.DEFAULT);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="w-full bg-linear-to-br from-slate-900 via-slate-900/90 to-emerald-950/30 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 shadow-xl backdrop-blur-md relative overflow-hidden flex flex-col justify-between gap-2.5">
      {/* Top Banner & Countdown */}
      <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30 text-emerald-400 shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="text-left">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
              {won ? "Victory Card" : "Game Over"}
            </span>
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
              {won ? `Solved in ${guesses.length}/${maxAttempts} Tries!` : "Better Luck Tomorrow!"}
            </h4>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-white/10 rounded-xl px-2.5 py-1 flex items-center gap-2 shrink-0">
          <Clock size={13} className="text-indigo-400 animate-pulse" />
          <CountDown isOpen={true} compact={true} />
        </div>
      </div>

      {/* Center Emoji Grid Preview */}
      <div className="flex flex-col items-center justify-center py-1">
        <div className="flex flex-col gap-1 p-2 rounded-xl bg-black/40 border border-white/5 shadow-inner">
          {emojiRows.map((row, rIdx) => (
            <div key={rIdx} className="flex gap-1">
              {row.map((cell, cIdx) => (
                <div
                  key={cIdx}
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-sm border ${cell.bg} flex items-center justify-center text-[9px] shadow-xs`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Prominent High-Visibility CTA Button */}
      <button
        onClick={handleShare}
        disabled={isSharing}
        className="w-full py-2.5 px-4 rounded-xl bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-98 text-slate-950 font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
      >
        {isSharing ? (
          <>
            <Loader2 size={16} className="animate-spin text-slate-950" />
            <span>Sharing Results...</span>
          </>
        ) : copied ? (
          <>
            <Check size={16} className="text-slate-950" />
            <span>Copied to Clipboard!</span>
          </>
        ) : (
          <>
            <Share2 size={16} className="text-slate-950" />
            <span>Share Your Result</span>
            <Copy size={13} className="opacity-60 ml-0.5" />
          </>
        )}
      </button>
    </div>
  );
};
