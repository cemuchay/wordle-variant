export interface AudioPeaks {
   peaks: number[]; // normalized 0..1
   duration: number; // seconds
}

const cache = new Map<string, AudioPeaks>();
const pending = new Map<string, Promise<AudioPeaks | null>>();

// Safari < 14.5 only supports the callback form of decodeAudioData
function decodeAudio(ctx: AudioContext, buffer: ArrayBuffer): Promise<AudioBuffer> {
   return new Promise((resolve, reject) => {
      const maybePromise = ctx.decodeAudioData(buffer, resolve, reject) as unknown;
      if (maybePromise && typeof (maybePromise as Promise<AudioBuffer>).then === "function") {
         (maybePromise as Promise<AudioBuffer>).then(resolve, reject);
      }
   });
}

/**
 * Decodes an audio URL into normalized peak buckets for waveform rendering.
 * Results are cached per URL; concurrent calls share one decode.
 * Returns null when decoding is unavailable — callers should fall back to
 * deterministic placeholder bars.
 */
export function getAudioPeaks(url: string, buckets = 40): Promise<AudioPeaks | null> {
   const hit = cache.get(url);
   if (hit) return Promise.resolve(hit);
   const inflight = pending.get(url);
   if (inflight) return inflight;

   const task = (async () => {
      let ctx: AudioContext | null = null;
      try {
         const response = await fetch(url);
         if (!response.ok) throw new Error(`HTTP ${response.status}`);
         const arrayBuffer = await response.arrayBuffer();
         const Ctor = window.AudioContext
            ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
         if (!Ctor) throw new Error("Web Audio API unavailable");
         ctx = new Ctor();
         const audioBuffer = await decodeAudio(ctx, arrayBuffer);
         const channel = audioBuffer.getChannelData(0);
         const block = Math.max(1, Math.floor(channel.length / buckets));
         const peaks: number[] = [];
         for (let i = 0; i < buckets; i++) {
            let max = 0;
            const startIdx = i * block;
            const endIdx = Math.min(startIdx + block, channel.length);
            for (let j = startIdx; j < endIdx; j++) {
               const v = Math.abs(channel[j]);
               if (v > max) max = v;
            }
            peaks.push(max);
         }
         const normalize = Math.max(...peaks, 0.01);
         const result: AudioPeaks = {
            peaks: peaks.map((p) => p / normalize),
            duration: audioBuffer.duration,
         };
         cache.set(url, result);
         return result;
      } catch {
         return null;
      } finally {
         try { ctx?.close(); } catch { /* noop */ }
         pending.delete(url);
      }
   })();

   pending.set(url, task);
   return task;
}

/** Deterministic placeholder bars (stable per seed — never re-rolls on render). */
export function fallbackPeaks(seed: string, buckets = 40): number[] {
   let h = 2166136261;
   for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
   }
   const out: number[] = [];
   for (let i = 0; i < buckets; i++) {
      h = Math.imul(h ^ (i + 1), 2654435761);
      out.push(0.25 + ((h >>> 8) % 1000) / 1000 * 0.75);
   }
   return out;
}
