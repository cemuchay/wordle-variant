import { useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { useVoicePlaybackStore, type VoiceMessageLike } from "../../../store/useVoicePlaybackStore";

interface ConnectedAudioPlayerProps {
  url: string;
  messageId: string;
  allMessageIds?: string[];
  allMessages?: VoiceMessageLike[];
  userId: string;
}

export const ConnectedAudioPlayer = ({
  url,
  messageId,
  allMessageIds,
  allMessages,
  userId,
}: ConnectedAudioPlayerProps) => {
  const currentlyPlaying = useVoicePlaybackStore((s) => s.currentlyPlaying);
  const registerAudio = useVoicePlaybackStore((s) => s.registerAudio);
  const unregisterAudio = useVoicePlaybackStore((s) => s.unregisterAudio);
  const play = useVoicePlaybackStore((s) => s.play);
  const pause = useVoicePlaybackStore((s) => s.pause);
  const playNext = useVoicePlaybackStore((s) => s.playNext);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlaying = currentlyPlaying?.messageId === messageId;

  useEffect(() => {
    const ref = audioRef.current;
    if (!ref) return;
    registerAudio(messageId, ref, url);
    return () => {
      unregisterAudio(messageId);
    };
  }, [messageId, url, registerAudio, unregisterAudio]);

  const handleEnded = () => {
    if (allMessageIds && allMessages) {
      playNext(allMessageIds, allMessages, userId);
    }
  };

  const handleToggle = () => {
    if (isPlaying) {
      pause();
    } else {
      play(messageId);
    }
  };

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-xl min-w-[220px] border my-1 transition-colors ${
        isPlaying
          ? "bg-correct/15 border-correct/40 shadow-[0_0_12px_rgba(0,230,150,0.15)]"
          : "bg-black/30 border-white/5"
      }`}
    >
      <audio
        ref={audioRef}
        src={url}
        onEnded={handleEnded}
        preload="metadata"
      />
      <button
        type="button"
        onClick={handleToggle}
        className="w-8 h-8 rounded-full bg-correct text-black flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
      >
        {isPlaying ? (
          <Pause size={14} fill="black" />
        ) : (
          <Play size={14} fill="black" className="ml-0.5" />
        )}
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="flex gap-0.5">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={`w-0.5 rounded-full transition-all ${
                isPlaying ? "bg-correct animate-pulse" : "bg-white/20"
              }`}
              style={{
                height: `${4 + Math.random() * 8}px`,
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-white/50">
          Voice Note {isPlaying && "• Playing"}
        </span>
      </div>
    </div>
  );
};
