import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { renderEmojiNode } from "../../utils/twemoji";

export interface WordEffectBurst {
   id: string;
   emoji: string;
}

interface WordEffectOverlayProps {
   bursts: WordEffectBurst[];
   onBurstComplete: (id: string) => void;
}

interface FloatingParticle {
   id: number;
   leftPct: number;
   sizePx: number;
   swayPx: number;
   rotStart: number;
   rotEnd: number;
   delay: number;
   duration: number;
   scalePeak: number;
}

function createBurstParticles(seedStr: string, reducedMotion: boolean): FloatingParticle[] {
   // Simple deterministic PRNG seeded from burst id so particles stay stable across re-renders
   let seed = 0;
   for (let i = 0; i < seedStr.length; i++) {
      seed = (seed * 31 + seedStr.charCodeAt(i)) | 0;
   }
   const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) | 0;
      return ((seed >>> 0) % 10000) / 10000;
   };

   const count = reducedMotion ? 8 : 22;
   return Array.from({ length: count }, (_, i) => {
      const lane = (i + 0.5) / count;
      const jitter = (nextRand() - 0.5) * (90 / count);
      const leftPct = Math.min(94, Math.max(6, lane * 88 + 6 + jitter));
      const sizePx = Math.round(22 + nextRand() * 18); // 22px - 40px
      const swayDir = nextRand() > 0.5 ? 1 : -1;
      const swayPx = swayDir * (14 + nextRand() * 26);
      const rotStart = (nextRand() - 0.5) * 28;
      const rotEnd = rotStart + (nextRand() - 0.5) * 44;
      const delay = reducedMotion ? nextRand() * 0.35 : nextRand() * 0.9;
      const duration = reducedMotion ? 1.8 + nextRand() * 0.5 : 2.3 + nextRand() * 1.3;
      const scalePeak = 0.9 + nextRand() * 0.35;

      return {
         id: i,
         leftPct,
         sizePx,
         swayPx,
         rotStart,
         rotEnd,
         delay,
         duration,
         scalePeak,
      };
   });
}

function BurstLayer({
   burst,
   reducedMotion,
   onComplete,
}: {
   burst: WordEffectBurst;
   reducedMotion: boolean;
   onComplete: (id: string) => void;
}) {
   const particles = useMemo(
      () => createBurstParticles(burst.id, reducedMotion),
      [burst.id, reducedMotion],
   );

   useEffect(() => {
      const maxTimeMs =
         Math.max(...particles.map((p) => (p.delay + p.duration) * 1000)) + 150;
      const timer = window.setTimeout(() => {
         onComplete(burst.id);
      }, maxTimeMs);
      return () => window.clearTimeout(timer);
   }, [burst.id, particles, onComplete]);

   return (
      <div
         data-testid="word-effect-burst"
         className="pointer-events-none absolute inset-0 overflow-hidden"
         aria-hidden="true"
      >
         {particles.map((p) => (
            <motion.div
               key={p.id}
               data-testid="word-effect-particle"
               initial={{
                  top: "105%",
                  x: 0,
                  opacity: 0,
                  scale: 0.45,
                  rotate: p.rotStart,
               }}
               animate={{
                  top: "-14%",
                  x: reducedMotion
                     ? 0
                     : [0, p.swayPx, -p.swayPx * 0.65, p.swayPx * 0.35],
                  opacity: [0, 1, 1, 0.85, 0],
                  scale: [0.45, p.scalePeak, p.scalePeak * 1.05, p.scalePeak * 0.85],
                  rotate: reducedMotion ? 0 : [p.rotStart, (p.rotStart + p.rotEnd) / 2, p.rotEnd],
               }}
               transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: "easeOut",
                  opacity: {
                     duration: p.duration,
                     delay: p.delay,
                     times: [0, 0.14, 0.72, 0.88, 1],
                     ease: "linear",
                  },
               }}
               style={{
                  position: "absolute",
                  left: `${p.leftPct}%`,
                  fontSize: `${p.sizePx}px`,
                  lineHeight: 1,
               }}
               className="select-none will-change-transform filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
            >
               {renderEmojiNode(burst.emoji, `we-${burst.id}-${p.id}`)}
            </motion.div>
         ))}
      </div>
   );
}

export function WordEffectOverlay({
   bursts,
   onBurstComplete,
}: WordEffectOverlayProps) {
   const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

   return (
      <div
         className="pointer-events-none absolute inset-0 overflow-hidden z-[110]"
         aria-hidden="true"
      >
         <AnimatePresence>
            {bursts.map((burst) => (
               <BurstLayer
                  key={burst.id}
                  burst={burst}
                  reducedMotion={reducedMotion}
                  onComplete={onBurstComplete}
               />
            ))}
         </AnimatePresence>
      </div>
   );
}

export default WordEffectOverlay;
