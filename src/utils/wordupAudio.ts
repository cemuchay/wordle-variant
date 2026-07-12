// src/utils/wordupAudio.ts

class WordUpAudioManager {
   private ctx: AudioContext | null = null;
   private enabled = false;

   constructor() {
      const saved = localStorage.getItem("wordup_sound_enabled");
      this.enabled = saved === "true";
   }

   private initContext() {
      if (!this.ctx) {
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
      }
   }

   public playMatchFound() {
      if (!this.enabled) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
         if (!this.ctx) return;
         const t = now + idx * 0.1;
         const g = this.ctx.createGain();
         g.gain.setValueAtTime(0, t);
         g.gain.linearRampToValueAtTime(0.15, t + 0.02);
         g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
         g.connect(this.ctx.destination);
         const o = this.ctx.createOscillator();
         o.type = "sine";
         o.frequency.setValueAtTime(freq, t);
         o.connect(g);
         o.start(t);
         o.stop(t + 0.2);
      });
   }

    public playGameStart() {
       if (!this.enabled) return;
       this.initContext();
       if (!this.ctx) return;

       const now = this.ctx.currentTime;
       const g = this.ctx.createGain();
       g.gain.setValueAtTime(0, now);
       g.gain.linearRampToValueAtTime(0.18, now + 0.02);
       g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
       g.connect(this.ctx.destination);

       const o = this.ctx.createOscillator();
       o.type = "sine";
       o.frequency.setValueAtTime(880.0, now); // C5 / E5 start chime
       o.connect(g);
       o.start(now);
       o.stop(now + 0.5);
    }

    public playMatchmakingTick() {
       if (!this.enabled) return;
       this.initContext();
       if (!this.ctx) return;

       const now = this.ctx.currentTime;
       const g = this.ctx.createGain();
       g.gain.setValueAtTime(0, now);
       g.gain.linearRampToValueAtTime(0.06, now + 0.01);
       g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
       g.connect(this.ctx.destination);

       const o = this.ctx.createOscillator();
       o.type = "sine";
       o.frequency.setValueAtTime(329.63, now); // Soft E4 beat
       o.connect(g);
       o.start(now);
       o.stop(now + 0.1);
    }

    public playCountdownTick(_num: number) {
       if (!this.enabled) return;
       this.initContext();
       if (!this.ctx) return;

       const now = this.ctx.currentTime;
       const g = this.ctx.createGain();
       g.gain.setValueAtTime(0, now);
       g.gain.linearRampToValueAtTime(0.12, now + 0.01);
       g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
       g.connect(this.ctx.destination);

       const o = this.ctx.createOscillator();
       o.type = "sine";
       o.frequency.setValueAtTime(440.0, now); // A4 boop
       o.connect(g);
       o.start(now);
       o.stop(now + 0.18);
    }

   public playFinalRound() {
      if (!this.enabled) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [261.63, 329.63, 392.0];
      notes.forEach((freq, idx) => {
         if (!this.ctx) return;
         const t = now + idx * 0.15;
         const g = this.ctx.createGain();
         g.gain.setValueAtTime(0, t);
         g.gain.linearRampToValueAtTime(0.18, t + 0.05);
         g.gain.setValueAtTime(0.18, t + 0.4);
         g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
         g.connect(this.ctx.destination);

         const s = this.ctx.createOscillator();
         s.type = "sawtooth";
         s.frequency.setValueAtTime(freq, t);
         s.connect(g);

         const t2 = this.ctx.createOscillator();
         t2.type = "triangle";
         t2.frequency.setValueAtTime(freq * 2, t);
         const tg = this.ctx.createGain();
         tg.gain.setValueAtTime(0, t);
         tg.gain.linearRampToValueAtTime(0.06, t + 0.05);
         tg.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
         t2.connect(tg);
         tg.connect(this.ctx.destination);

         s.start(t);
         s.stop(t + 1.0);
         t2.start(t);
         t2.stop(t + 1.0);
      });
   }

   public playRoundTransition() {
      if (!this.enabled) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.15;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
         const t = i / this.ctx.sampleRate;
         const freq = 800 - (800 - 200) * (t / 0.15);
         data[i] = (Math.random() * 2 - 1) * Math.sin(2 * Math.PI * freq * t) * (1 - t / 0.15);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      src.connect(g);
      g.connect(this.ctx.destination);
      src.start(now);
   }

   public playTimeUp() {
      if (!this.enabled) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      g.connect(this.ctx.destination);

      [493.88, 523.25, 493.88, 523.25].forEach((freq, idx) => {
         if (!this.ctx) return;
         const t = now + idx * 0.08;
         const o = this.ctx.createOscillator();
         o.type = "square";
         o.frequency.setValueAtTime(freq, t);
         const og = this.ctx.createGain();
         og.gain.setValueAtTime(0, t);
         og.gain.linearRampToValueAtTime(0.12, t + 0.01);
         og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
         o.connect(og);
         og.connect(g);
         o.start(t);
         o.stop(t + 0.1);
      });
   }

   public playVictory() {
      if (!this.enabled) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
         if (!this.ctx) return;
         const t = now + idx * 0.12;
         const g = this.ctx.createGain();
         g.gain.setValueAtTime(0, t);
         g.gain.linearRampToValueAtTime(0.2, t + 0.03);
         if (idx < 3) g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
         else g.gain.setValueAtTime(0.2, t + 0.15);
         g.connect(this.ctx.destination);

         const s = this.ctx.createOscillator();
         s.type = "sine";
         s.frequency.setValueAtTime(freq, t);
         s.connect(g);

         if (idx === 3) {
            const t2 = this.ctx.createOscillator();
            t2.type = "triangle";
            t2.frequency.setValueAtTime(freq, t);
            const h = this.ctx.createGain();
            h.gain.setValueAtTime(0, t);
            h.gain.linearRampToValueAtTime(0.12, t + 0.05);
            h.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
            t2.connect(h);
            h.connect(this.ctx.destination);
            t2.start(t);
            t2.stop(t + 1.0);
         }

         s.start(t);
         s.stop(t + 1.0);
      });
   }

   public playDefeat() {
      if (!this.enabled) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [440.0, 349.23, 293.66];
      notes.forEach((freq, idx) => {
         if (!this.ctx) return;
         const t = now + idx * 0.2;
         const g = this.ctx.createGain();
         g.gain.setValueAtTime(0, t);
         g.gain.linearRampToValueAtTime(0.12, t + 0.05);
         g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
         g.connect(this.ctx.destination);

         const o = this.ctx.createOscillator();
         o.type = "triangle";
         o.frequency.setValueAtTime(freq, t);
         o.connect(g);
         o.start(t);
         o.stop(t + 1.2);
      });
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
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.12, now + 0.002);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      masterGain.connect(this.ctx.destination);

      const bufferSize = Math.floor(this.ctx.sampleRate * 0.04);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
         data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.connect(masterGain);
      noise.start(now);
      noise.stop(now + 0.04);

      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1000, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(0.08, now + 0.002);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.05);
   }

}

export const wordupAudio = new WordUpAudioManager();
