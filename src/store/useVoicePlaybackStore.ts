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
  audioRefs: Record<string, HTMLAudioElement>;

  registerAudio: (id: string, ref: HTMLAudioElement, url: string) => void;
  unregisterAudio: (id: string) => void;
  play: (id: string) => void;
  pause: () => void;
  stop: () => void;
  playNext: (messageIds: string[], messages: VoiceMessageLike[], userId: string) => void;
}

export const useVoicePlaybackStore = create<VoicePlaybackState>((set, get) => ({
  currentlyPlaying: null,
  audioRefs: {},

  registerAudio: (id, ref, _url) => {
    set((s) => ({ audioRefs: { ...s.audioRefs, [id]: ref } }));
  },

  unregisterAudio: (id) => {
    set((s) => {
      const { [id]: _ref, ...rest } = s.audioRefs;
      return { audioRefs: rest };
    });
  },

  play: (id) => {
    const { audioRefs, currentlyPlaying } = get();
    if (currentlyPlaying && currentlyPlaying.messageId !== id) {
      const prevRef = audioRefs[currentlyPlaying.messageId];
      if (prevRef) {
        prevRef.pause();
        prevRef.currentTime = 0;
      }
    }
    const ref = audioRefs[id];
    if (!ref) return;
    ref.currentTime = 0;
    // iOS PWA: bypass silent switch
    try {
      const session = (navigator as any).audioSession;
      if (session) session.type = 'playback';
    } catch { /* noop */ }
    ref.load();
    ref.play().catch(console.error);
    set({
      currentlyPlaying: {
        url: ref.src,
        messageId: id,
        duration: ref.duration || 0,
      },
    });
  },

  pause: () => {
    const { currentlyPlaying, audioRefs } = get();
    if (!currentlyPlaying) return;
    const ref = audioRefs[currentlyPlaying.messageId];
    if (ref) ref.pause();
  },

  stop: () => {
    const { currentlyPlaying, audioRefs } = get();
    if (!currentlyPlaying) return;
    const ref = audioRefs[currentlyPlaying.messageId];
    if (ref) {
      ref.pause();
      ref.currentTime = 0;
    }
    set({ currentlyPlaying: null });
  },

  playNext: (messageIds, messages, _currentUserId) => {
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
