/*
 * Glitch-free voice note recorder.
 *
 * Captures PCM via AudioWorklet (off the main thread) so UI jank can never
 * starve audio callbacks (the failure mode of the deprecated
 * ScriptProcessorNode this replaces). Output is 16-bit mono WAV — the only
 * audio format every major browser can play without server transcoding.
 */

const WORKLET_CODE = `
class PCMChunkProcessor extends AudioWorkletProcessor {
    process(inputs) {
        const input = inputs[0];
        if (input && input[0] && input[0].length > 0) {
            this.port.postMessage(input[0]);
        }
        return true;
    }
}
registerProcessor('pcm-chunk-processor', PCMChunkProcessor);
`;

const DEFAULT_MAX_DURATION_MS = 120000;

export interface VoiceRecorderOptions {
   /** Auto-stop after this long. Defaults to 120s. */
   maxDurationMs?: number;
   /** Per-chunk RMS level (0..1) for metering UI. */
   onLevel?: (level: number) => void;
   /** Fired when maxDurationMs is reached; caller should call stop(). */
   onMaxDuration?: () => void;
}

export class VoiceRecorder {
   private ctx: AudioContext | null = null;
   private stream: MediaStream | null = null;
   private source: MediaStreamAudioSourceNode | null = null;
   private worklet: AudioWorkletNode | null = null;
   private processor: ScriptProcessorNode | null = null;
   private silentGain: GainNode | null = null;
   private workletUrl: string | null = null;

   // Merged ~1s buffers to avoid thousands of tiny allocations
   private chunks: Float32Array[] = [];
   private staging: Float32Array[] = [];
   private stagingSamples = 0;
   private sampleRate = 16000;
   private stopped = false;
   private maxTimer: number | null = null;
   private options: VoiceRecorderOptions = {};

   async start(options: VoiceRecorderOptions = {}) {
      if (this.ctx && this.ctx.state !== "closed" && !this.stopped) return;
      this.options = options;
      this.chunks = [];
      this.staging = [];
      this.stagingSamples = 0;
      this.stopped = false;

      // 1. Acquire MediaStream with fallback for iOS Safari
      let stream: MediaStream;
      try {
         stream = await navigator.mediaDevices.getUserMedia({
            audio: {
               echoCancellation: true,
               noiseSuppression: true,
               autoGainControl: true,
            },
         });
      } catch (firstErr) {
         console.warn("[VoiceRecorder] Initial getUserMedia failed, retrying with minimal constraints for iOS/Safari:", firstErr);
         // Fallback to basic audio constraint (iOS Safari often rejects dictionary constraints on subsequent runs)
         stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // Ensure all tracks are enabled
      stream.getAudioTracks().forEach((track) => {
         track.enabled = true;
      });
      this.stream = stream;

      // 2. Initialize or Resume AudioContext
      const Ctor = window.AudioContext
         ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error("Web Audio API unavailable");

      let ctx: AudioContext;
      try {
         ctx = new Ctor({ sampleRate: 16000 });
      } catch {
         ctx = new Ctor();
      }

      if (ctx.state === "suspended") {
         await ctx.resume().catch(() => { /* gesture handling upstream */ });
      }
      this.ctx = ctx;
      this.sampleRate = ctx.sampleRate;
      this.source = ctx.createMediaStreamSource(this.stream);

      const sink = ctx.createGain();
      sink.gain.value = 0; // force processing without audible output
      this.silentGain = sink;
      sink.connect(ctx.destination);

      let usedWorklet = false;
      if (ctx.audioWorklet) {
         try {
            const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
            const url = URL.createObjectURL(blob);
            this.workletUrl = url;
            await ctx.audioWorklet.addModule(url);
            this.worklet = new AudioWorkletNode(ctx, "pcm-chunk-processor");
            this.worklet.port.onmessage = (e) => this.handleChunk(e.data as Float32Array);
            this.source.connect(this.worklet);
            this.worklet.connect(sink);
            usedWorklet = true;
         } catch (err) {
            console.warn("AudioWorklet unavailable, using ScriptProcessor fallback:", err);
         }
      }

      if (!usedWorklet) {
         this.processor = ctx.createScriptProcessor(4096, 1, 1);
         this.processor.onaudioprocess = (e) => {
            // Copy: the input buffer is reused by the element
            this.handleChunk(new Float32Array(e.inputBuffer.getChannelData(0)));
         };
         this.source.connect(this.processor);
         this.processor.connect(sink);
      }

      const max = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
      this.maxTimer = window.setTimeout(() => {
         options.onMaxDuration?.();
      }, max);
   }

   private handleChunk(chunk: Float32Array) {
      if (this.stopped) return;

      if (this.options.onLevel) {
         let sum = 0;
         for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
         this.options.onLevel(Math.sqrt(sum / chunk.length));
      }

      this.staging.push(chunk);
      this.stagingSamples += chunk.length;
      if (this.stagingSamples >= this.sampleRate) {
         const merged = new Float32Array(this.stagingSamples);
         let offset = 0;
         for (const c of this.staging) {
            merged.set(c, offset);
            offset += c.length;
         }
         this.staging = [];
         this.stagingSamples = 0;
         this.chunks.push(merged);
      }
   }

   /** Finalize and return the recorded WAV blob. */
   stop(): Blob {
      this.finish();
      this.flushStaging();
      const blob = this.encodeWav();
      this.teardown();
      return blob;
   }

   /** Discard the recording and release the microphone. */
   cancel(): void {
      this.finish();
      this.teardown();
   }

   getDurationMs(): number {
      return ((this.totalSamplesSafe()) / this.sampleRate) * 1000;
   }

   private totalSamplesSafe(): number {
      return this.chunks.reduce((acc, c) => acc + c.length, 0) + this.stagingSamples;
   }

   private finish() {
      this.stopped = true;
      if (this.maxTimer !== null) {
         clearTimeout(this.maxTimer);
         this.maxTimer = null;
      }
   }

   private flushStaging() {
      if (this.stagingSamples === 0) return;
      const merged = new Float32Array(this.stagingSamples);
      let offset = 0;
      for (const c of this.staging) {
         merged.set(c, offset);
         offset += c.length;
      }
      this.staging = [];
      this.stagingSamples = 0;
      this.chunks.push(merged);
   }

   private encodeWav(): Blob {
      const totalSamples = this.chunks.reduce((acc, c) => acc + c.length, 0);
      const buffer = new ArrayBuffer(44 + totalSamples * 2);
      const view = new DataView(buffer);

      const writeString = (offset: number, str: string) => {
         for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      };

      writeString(0, "RIFF");
      view.setUint32(4, 36 + totalSamples * 2, true);
      writeString(8, "WAVE");
      writeString(12, "fmt ");
      view.setUint32(16, 16, true);          // PCM chunk size
      view.setUint16(20, 1, true);           // PCM format
      view.setUint16(22, 1, true);           // mono
      view.setUint32(24, this.sampleRate, true);
      view.setUint32(28, this.sampleRate * 2, true); // byte rate
      view.setUint16(32, 2, true);           // block align
      view.setUint16(34, 16, true);          // bits per sample
      writeString(36, "data");
      view.setUint32(40, totalSamples * 2, true);

      let offset = 44;
      for (const c of this.chunks) {
         for (let i = 0; i < c.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, c[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
         }
      }

      return new Blob([view], { type: "audio/wav" });
   }

   private teardown() {
      try { this.source?.disconnect(); } catch { /* noop */ }
      try { this.worklet?.disconnect(); } catch { /* noop */ }
      try { this.processor?.disconnect(); } catch { /* noop */ }
      try { this.silentGain?.disconnect(); } catch { /* noop */ }

      // Stop all tracks so the browser recording indicator turns off
      try {
         this.stream?.getTracks().forEach((t) => {
            try { t.stop(); } catch { /* noop */ }
         });
      } catch { /* noop */ }

      // Safely close the AudioContext so subsequent instances start fresh without device lock
      try {
         if (this.ctx && this.ctx.state !== "closed") {
            void this.ctx.close().catch(() => {});
         }
      } catch { /* noop */ }

      if (this.workletUrl) {
         try { URL.revokeObjectURL(this.workletUrl); } catch { /* noop */ }
      }
      this.source = null;
      this.worklet = null;
      this.processor = null;
      this.silentGain = null;
      this.stream = null;
      this.ctx = null;
      this.workletUrl = null;
      this.chunks = [];
      this.staging = [];
      this.stagingSamples = 0;
   }
}
