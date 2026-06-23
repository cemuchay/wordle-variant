import { Play, Pause, X } from "lucide-react";
import { useVoicePlaybackStore } from "../../store/useVoicePlaybackStore";

export const VoiceControlBar = () => {
  const currentlyPlaying = useVoicePlaybackStore((s) => s.currentlyPlaying);
  const audioRefs = useVoicePlaybackStore((s) => s.audioRefs);
  const play = useVoicePlaybackStore((s) => s.play);
  const pause = useVoicePlaybackStore((s) => s.pause);
  const stop = useVoicePlaybackStore((s) => s.stop);

  if (!currentlyPlaying) return null;

  const ref = audioRefs[currentlyPlaying.messageId];
  const isPaused = ref ? ref.paused : false;

  const handleToggle = () => {
    if (isPaused) {
      play(currentlyPlaying.messageId);
    } else {
      pause();
    }
  };

  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-2 bg-slate-900/95 backdrop-blur-md border-b border-white/10 rounded-t-xl">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-6 h-6 rounded-full bg-correct/20 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-correct animate-pulse" />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-white/80 block truncate">
            Voice Note Playing
          </span>
          <span className="text-[8px] text-white/40 font-mono">
            {isPaused ? "Paused" : "Playing"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleToggle}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          title={isPaused ? "Play" : "Pause"}
        >
          {isPaused ? (
            <Play size={12} fill="white" className="ml-0.5 text-white" />
          ) : (
            <Pause size={12} fill="white" className="text-white" />
          )}
        </button>
        <button
          type="button"
          onClick={stop}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-red-400/20 flex items-center justify-center transition-colors cursor-pointer"
          title="Close"
        >
          <X size={12} className="text-white/60" />
        </button>
      </div>
    </div>
  );
};
