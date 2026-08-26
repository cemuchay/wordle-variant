import { create } from "zustand";

export interface VoiceMessageLike {
  id: string;
  user_id?: string | null;
  sender_id?: string | null;
  voice_url?: string | null;
}

interface PlayingMessage {
  url: string;
  messageId: string;
  duration: number;
}

interface VoicePlaybackState {
  currentlyPlaying: PlayingMessage | null;
  isPaused: boolean;
  audioRefs: Record<string, HTMLAudioElement>;

  registerAudio: (id: string, ref: HTMLAudioElement) => void;
  unregisterAudio: (id: string) => void;
  play: (id: string) => void;
  pause: () => void;
  stop: () => void;
  /** Silently primes chained <audio> elements so iOS allows auto-advance. */
  unlockChain: (ids: string[]) => void;
  playNext: (messageIds: string[], messages: VoiceMessageLike[]) => void;
}

const attemptPlay = (ref: HTMLAudioElement, onFail?: () => void) => {
  // iOS PWA: bypass silent switch
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
  } catch { /* noop */ }

  const start = () => {
    ref.play().catch((err) => {
      // One retry once the element can play — recovers transient loading races
      if (err?.name === "NotSupportedError" || err?.name === "AbortError") {
        const retry = () => {
          ref.removeEventListener("canplay", retry);
          ref.play().catch(() => onFail?.());
        };
        ref.addEventListener("canplay", retry);
        setTimeout(() => ref.removeEventListener("canplay", retry), 4000);
      } else {
        onFail?.();
      }
    });
  };

  // Never call load()+play() back-to-back — the load abort races playback.
  if (ref.readyState >= 2) {
    start();
  } else {
    const whenReady = () => {
      ref.removeEventListener("canplay", whenReady);
      start();
    };
    ref.addEventListener("canplay", whenReady);
    setTimeout(() => ref.removeEventListener("canplay", whenReady), 4000);
  }
};

export const useVoicePlaybackStore = create<VoicePlaybackState>((set, get) => ({
  currentlyPlaying: null,
  isPaused: false,
  audioRefs: {},

  registerAudio: (id, ref) => {
    set((s) => ({ audioRefs: { ...s.audioRefs, [id]: ref } }));
  },

  unregisterAudio: (id) => {
    set((s) => {
      const rest = { ...s.audioRefs };
      delete rest[id];
      return { audioRefs: rest };
    });
  },

  play: (id) => {
    const { audioRefs, currentlyPlaying } = get();

    // Resume same track where it left off instead of restarting
    if (currentlyPlaying?.messageId === id) {
      const ref = audioRefs[id];
      if (!ref) return;
      set({ isPaused: false });
      attemptPlay(ref, () => set({ isPaused: true }));
      return;
    }

    if (currentlyPlaying) {
      const prevRef = audioRefs[currentlyPlaying.messageId];
      if (prevRef) prevRef.pause();
    }
    const ref = audioRefs[id];
    if (!ref) return;
    ref.currentTime = 0;
    set({
      currentlyPlaying: {
        url: ref.src,
        messageId: id,
        duration: ref.duration || 0,
      },
      isPaused: false,
    });
    attemptPlay(ref, () => set({ isPaused: true }));
  },

  pause: () => {
    const { currentlyPlaying, audioRefs } = get();
    if (!currentlyPlaying) return;
    audioRefs[currentlyPlaying.messageId]?.pause();
    set({ isPaused: true });
  },

  stop: () => {
    const { currentlyPlaying, audioRefs } = get();
    if (!currentlyPlaying) return;
    const ref = audioRefs[currentlyPlaying.messageId];
    if (ref) {
      ref.pause();
      ref.currentTime = 0;
    }
    set({ currentlyPlaying: null, isPaused: false });
  },

  unlockChain: (ids) => {
    const { audioRefs } = get();
    ids.forEach((id) => {
      const ref = audioRefs[id];
      if (!ref || !ref.paused) return;
      ref.muted = true;
      ref.play()
        .then(() => {
          ref.pause();
          ref.currentTime = 0;
          ref.muted = false;
        })
        .catch(() => {
          ref.muted = false;
        });
    });
  },

  playNext: (messageIds, messages) => {
    const { currentlyPlaying } = get();
    if (!currentlyPlaying) return;
    const currentIdx = messageIds.indexOf(currentlyPlaying.messageId);
    if (currentIdx === -1 || currentIdx >= messageIds.length - 1) {
      get().stop();
      return;
    }
    const currentMsg = messages.find((m) => m.id === currentlyPlaying.messageId);
    if (!currentMsg) {
      get().stop();
      return;
    }
    const currentOwnerId = currentMsg.user_id || currentMsg.sender_id || "";
    const nextId = messageIds[currentIdx + 1];
    const nextMsg = messages.find((m) => m.id === nextId);
    const nextOwnerId = nextMsg ? (nextMsg.user_id || nextMsg.sender_id || "") : "";
    if (nextMsg && nextOwnerId === currentOwnerId && nextOwnerId !== "" && nextMsg.voice_url) {
      get().play(nextId);
    } else {
      get().stop();
    }
  },
}));
