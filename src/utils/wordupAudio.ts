// src/utils/wordupAudio.ts

class WordUpAudioManager {
   private ctx: AudioContext | null = null;
   private enabled = false;
   private ambientNode: GainNode | null = null;
   private ambientOscs: OscillatorNode[] = [];

   constructor() {
      // Check localStorage for saved sound preference
      const saved = localStorage.getItem("wordup_sound_enabled");
      this.enabled = saved === "true";
   }

   private initContext() {
      if (!this.ctx) {
         // Fallback to webkitAudioContext if necessary
         const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
         this.ctx = new AudioCtx();
      }
      if (this.ctx.state === "suspended") {
         this.ctx.resume();
      }
   }

   public isEnabled(): boolean {
      return this.enabled;
   }

   public setEnabled(val: boolean) {
      this.enabled = val;
      localStorage.setItem("wordup_sound_enabled", String(val));
      if (val) {
         this.initContext();
         this.startAmbient();
      } else {
         this.stopAmbient();
      }
   }

   public playMatchStart() {
      if (!this.enabled) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // Gong-like warm chime
      const frequencies = [130.81, 196.00, 261.63, 329.63]; // C3, G3, C4, E4
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.25, now + 0.05);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      masterGain.connect(this.ctx.destination);

      frequencies.forEach((freq, idx) => {
         if (!this.ctx) return;
         const osc = this.ctx.createOscillator();
         osc.type = idx % 2 === 0 ? "triangle" : "sine";
         osc.frequency.setValueAtTime(freq, now);
         osc.connect(masterGain);
         osc.start(now);
         osc.stop(now + 2.0);
      });
   }

   public playCorrect() {
      if (!this.enabled) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      gain.connect(this.ctx.destination);

      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.45);
   }

   public playIncorrect() {
      if (!this.enabled) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      gain.connect(this.ctx.destination);

      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140.0, now); // Buzzing descending pitch
      osc.frequency.linearRampToValueAtTime(80.0, now + 0.3);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.45);
   }

   public playTicking() {
      if (!this.enabled) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      gain.connect(this.ctx.destination);

      const osc = this.ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1500, now);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.06);
   }

   public startAmbient() {
      if (!this.enabled) return;
      this.initContext();
      if (!this.ctx) return;

      // Avoid creating multiple ambient pads
      if (this.ambientNode) return;

      const now = this.ctx.currentTime;
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.04, now + 2.0); // Extremely soft ambient pad
      gainNode.connect(this.ctx.destination);
      this.ambientNode = gainNode;

      // F major 9 ambient drone: F2 (87Hz), C3 (130Hz), E3 (164Hz), A3 (220Hz), G4 (392Hz)
      const freqs = [87.31, 130.81, 164.81, 220.00, 392.00];

      freqs.forEach((freq, idx) => {
         if (!this.ctx) return;
         const osc = this.ctx.createOscillator();
         osc.type = "triangle";
         osc.frequency.setValueAtTime(freq, now);

         // Add subtle detuning animation to simulate an analog synthesizer pad
         const detuneLFO = this.ctx.createOscillator();
         detuneLFO.frequency.setValueAtTime(0.1 + idx * 0.05, now); // Slow detune
         const lfoGain = this.ctx.createGain();
         lfoGain.gain.setValueAtTime(8 + idx * 2, now); // +- detune amount

         detuneLFO.connect(lfoGain);
         lfoGain.connect(osc.detune);

         osc.connect(gainNode);
         
         detuneLFO.start(now);
         osc.start(now);

         this.ambientOscs.push(osc);
         this.ambientOscs.push(detuneLFO as any); // Track LFO for stopping
      });
   }

   public stopAmbient() {
      if (this.ambientNode && this.ctx) {
         const now = this.ctx.currentTime;
         const node = this.ambientNode;
         // Fade out smoothly over 1.0 second
         node.gain.setValueAtTime(node.gain.value, now);
         node.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
         
         setTimeout(() => {
            node.disconnect();
         }, 1100);

         this.ambientNode = null;
      }

      this.ambientOscs.forEach((osc) => {
         try {
            osc.stop();
            osc.disconnect();
         } catch (e) {}
      });
      this.ambientOscs = [];
   }
}

export const wordupAudio = new WordUpAudioManager();
