import { useEffect, useRef, useState } from "react";
import { Play, Pause, AlertTriangle } from "lucide-react";
import { useVoicePlaybackStore, type VoiceMessageLike } from "../../../store/useVoicePlaybackStore";
import { getAudioPeaks, fallbackPeaks, type AudioPeaks } from "../../../utils/audioPeaks";

interface ConnectedAudioPlayerProps {
  url: string;
  messageId: string;
  allMessageIds?: string[];
  allMessages?: VoiceMessageLike[];
  userId: string;
}

const BAR_COUNT = 40;

const formatTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const ConnectedAudioPlayer = ({
  url,
  messageId,
  allMessageIds,
  allMessages,
}: ConnectedAudioPlayerProps) => {
  const currentlyPlaying = useVoicePlaybackStore((s) => s.currentlyPlaying);
  const isPaused = useVoicePlaybackStore((s) => s.isPaused);
  const registerAudio = useVoicePlaybackStore((s) => s.registerAudio);
  const unregisterAudio = useVoicePlaybackStore((s) => s.unregisterAudio);
  const play = useVoicePlaybackStore((s) => s.play);
  const pause = useVoicePlaybackStore((s) => s.pause);
  const playNext = useVoicePlaybackStore((s) => s.playNext);
  const unlockChain = useVoicePlaybackStore((s) => s.unlockChain);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chainUnlockedRef = useRef(false);
  const swapResumeRef = useRef<{ time: number; wasPlaying: boolean } | null>(null);

  // Track the latest playback position so an optimistic blob→remote URL swap
  // can resume exactly where the listener was.
  const lastTimeRef = useRef(0);

  // Decoded waveforms keyed by URL — no synchronous state resets in effects
  const [decodedByUrl, setDecodedByUrl] = useState<Record<string, AudioPeaks>>({});
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [hasError, setHasError] = useState(false);

  // Real waveform peaks (cached per URL); deterministic fallback while
  // decoding or when decode is unavailable — never re-rolls on render.
  useEffect(() => {
    let alive = true;
    getAudioPeaks(url).then((result) => {
      if (!alive || !result) return;
      setDecodedByUrl((prev) => ({ ...prev, [url]: result }));
    });
    return () => {
      alive = false;
    };
  }, [url]);

  const decoded = decodedByUrl[url];
  const bars = decoded?.peaks ?? fallbackPeaks(messageId, BAR_COUNT);
  const decodedDuration = decoded?.duration ?? 0;
  const duration = progress.duration || decodedDuration;
  const progressPct = duration > 0 ? Math.min(progress.current / duration, 1) : 0;

  // Preserve position/playback across src swaps (optimistic URL upgrade)
  useEffect(() => {
    const ref = audioRef.current;
    if (ref && !ref.paused && lastTimeRef.current > 0) {
      swapResumeRef.current = { time: lastTimeRef.current, wasPlaying: true };
    }
  }, [url]);

  // Playback state listeners
  useEffect(() => {
    const ref = audioRef.current;
    if (!ref) return;

    const onTimeUpdate = () => {
      lastTimeRef.current = ref.currentTime;
      setProgress((p) => ({ current: ref.currentTime, duration: ref.duration || p.duration }));
    };
    const onLoadedMetadata = () => {
      const resume = swapResumeRef.current;
      swapResumeRef.current = null;
      if (resume && Number.isFinite(ref.duration)) {
        try { ref.currentTime = Math.min(resume.time, ref.duration); } catch { /* noop */ }
        if (resume.wasPlaying) ref.play().catch(() => { /* surfaced via error state */ });
      }
      setProgress((p) => ({ ...p, duration: ref.duration || p.duration || decodedDuration }));
    };

    ref.addEventListener("timeupdate", onTimeUpdate);
    ref.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => {
      ref.removeEventListener("timeupdate", onTimeUpdate);
      ref.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [decodedDuration]);

  useEffect(() => {
    const ref = audioRef.current;
    if (!ref) return;
    registerAudio(messageId, ref);
    return () => {
      unregisterAudio(messageId);
    };
  }, [messageId, url, registerAudio, unregisterAudio]);

  const handleEnded = () => {
    if (allMessageIds && allMessages) {
      playNext(allMessageIds, allMessages);
    }
  };

  const handleToggle = () => {
    if (!chainUnlockedRef.current && allMessageIds?.length) {
      chainUnlockedRef.current = true;
      unlockChain(allMessageIds);
    }
    if (hasError) setHasError(false);
    const isActive = currentlyPlaying?.messageId === messageId;
    if (isActive && !isPaused) {
      pause();
    } else {
      play(messageId);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const ref = audioRef.current;
    if (!ref || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    ref.currentTime = pct * duration;
    lastTimeRef.current = ref.currentTime;
    setProgress((p) => ({ ...p, current: ref.currentTime }));
  };

  const isActive = currentlyPlaying?.messageId === messageId;
  const isPlaying = isActive && !isPaused;
  const totalDisplay = formatTime(duration);
  const elapsedDisplay = formatTime(progress.current);

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-xl min-w-[240px] border my-1 transition-colors ${
        isActive
          ? "bg-correct/15 border-correct/40 shadow-[0_0_12px_rgba(0,230,150,0.15)]"
          : "bg-black/30 border-white/5"
      }`}
    >
      <audio
        ref={audioRef}
        src={url}
        onEnded={handleEnded}
        onError={() => setHasError(true)}
        preload="auto"
      />
      <button
        type="button"
        onClick={handleToggle}
        className="w-8 h-8 shrink-0 rounded-full bg-correct text-black flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
        title={hasError ? "Tap to retry" : isPlaying ? "Pause" : "Play"}
      >
        {hasError ? (
          <AlertTriangle size={14} />
        ) : isPlaying ? (
          <Pause size={14} fill="black" />
        ) : (
          <Play size={14} fill="black" className="ml-0.5" />
        )}
      </button>
      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <div
          className="relative h-6 flex items-center gap-[2px] cursor-pointer"
          onClick={handleSeek}
        >
          {/* Base waveform */}
          <div className="flex items-center gap-[2px] w-full">
            {bars.map((peak, i) => (
              <div
                key={i}
                className={`flex-1 rounded-full transition-colors ${
                  hasError ? "bg-red-400/40" : "bg-white/20"
                }`}
                style={{ height: `${4 + peak * 18}px` }}
              />
            ))}
          </div>
          {/* Progress fill overlay */}
          <div
            className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none"
            style={{ width: `${progressPct * 100}%` }}
          >
            <div className="flex items-center gap-[2px] h-full" style={{ width: `${bars.length * 4}%`, minWidth: "100%" }}>
              {bars.map((peak, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-full ${isPlaying ? "bg-correct" : "bg-correct/60"}`}
                  style={{ height: `${4 + peak * 18}px` }}
                />
              ))}
            </div>
          </div>
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-white/50">
          {hasError ? (
            <span className="text-red-400">Failed — tap to retry</span>
          ) : (
            <>
              Voice Note {isPlaying && "• Playing"}
              <span className="ml-2 font-mono normal-case tracking-normal text-white/40 select-none">
                {elapsedDisplay} / {totalDisplay}
              </span>
            </>
          )}
        </span>
      </div>
    </div>
  );
};
