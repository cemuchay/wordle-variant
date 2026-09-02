import { useState, useEffect } from "react";
import { BookOpen, Sparkles, Volume2, Loader2 } from "lucide-react";
import { fetchWordDefinition, type DictionaryDefinition } from "../../utils/wordgrid/dictionary";

interface WordTriviaCardProps {
  word: string;
  isWon?: boolean;
  attemptsCount?: number;
  maxAttempts?: number;
}

export const WordTriviaCard: React.FC<WordTriviaCardProps> = ({
  word,
  isWon = true,
  attemptsCount,
  maxAttempts = 6,
}) => {
  const [definitionData, setDefinitionData] = useState<DictionaryDefinition | null>(null);
  const [phonetic, setPhonetic] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!word) return;
    let isMounted = true;
    setLoading(true);

    const loadDetails = async () => {
      try {
        const def = await fetchWordDefinition(word);
        if (!isMounted) return;
        setDefinitionData(def);
        if (def.phonetic) {
          setPhonetic(def.phonetic);
        }
      } catch (e) {
        console.error("Failed to load trivia definition:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [word]);

  const playPronunciation = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => {});
    } else if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.rate = 0.85;
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="w-full bg-slate-900/80 border border-indigo-500/20 rounded-2xl p-3.5 sm:p-4 shadow-xl backdrop-blur-md relative overflow-hidden text-left flex flex-col justify-between gap-1.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-indigo-500/15 rounded-lg border border-indigo-500/30 text-indigo-400">
            <BookOpen size={14} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">
            Word Trivia & Definition
          </span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
          <Sparkles size={10} className="text-amber-400" />
          <span className="text-[8px] font-black uppercase tracking-wider text-gray-300">
            {isWon ? `Solved in ${attemptsCount}/${maxAttempts}` : "Daily Word"}
          </span>
        </div>
      </div>

      {/* Word and Phonetics */}
      <div className="flex items-center justify-between gap-2 my-0.5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white">
            {word}
          </h3>
          {phonetic && (
            <span className="text-xs font-mono text-gray-400">
              {phonetic}
            </span>
          )}
          {definitionData?.partOfSpeech && (
            <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.2 rounded">
              {definitionData.partOfSpeech}
            </span>
          )}
        </div>

        <button
          onClick={playPronunciation}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-gray-300 hover:text-white border border-white/10 transition-all cursor-pointer shrink-0"
          title="Listen to pronunciation"
        >
          <Volume2 size={15} />
        </button>
      </div>

      {/* Definition Content */}
      <div className="min-h-[32px]">
        {loading ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 py-1">
            <Loader2 size={12} className="animate-spin text-indigo-400" />
            <span>Looking up definition...</span>
          </div>
        ) : (
          <p className="text-xs text-gray-300 leading-snug line-clamp-3">
            {definitionData?.definition || "A valid English word used in today's daily puzzle."}
          </p>
        )}
      </div>
    </div>
  );
};
