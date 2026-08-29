import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface ReactionSplashProps {
    emoji: string;
    onComplete?: () => void;
    /** Origin anchor: defaults to center/bottom of container */
    className?: string;
}

interface Particle {
    id: number;
    angle: number;
    distance: number;
    scale: number;
    rotation: number;
    delay: number;
}

export function ReactionSplash({ emoji, onComplete, className = "" }: ReactionSplashProps) {
    // Generate deterministic burst particle coordinates once per mount
    const particles = useMemo<Particle[]>(() => {
        const count = 7;
        return Array.from({ length: count }, (_, i) => {
            const baseAngle = (i * (360 / count)) * (Math.PI / 180);
            const angleJitter = (Math.random() - 0.5) * 0.4;
            const finalAngle = baseAngle + angleJitter;
            const distance = 45 + Math.random() * 35; // 45px - 80px radius
            const scale = 0.55 + Math.random() * 0.4;
            const rotation = (Math.random() - 0.5) * 60;
            const delay = Math.random() * 0.05;
            return {
                id: i,
                angle: finalAngle,
                distance,
                scale,
                rotation,
                delay
            };
        });
    }, []);

    return (
        <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center z-[120] overflow-visible ${className}`}
            aria-hidden="true"
        >
            {/* 1. Shockwave glow ring */}
            <motion.div
                initial={{ scale: 0.2, opacity: 0.9, borderWidth: 3 }}
                animate={{ scale: [0.2, 2.0, 3.2], opacity: [0.9, 0.4, 0], borderWidth: [3, 1.5, 0] }}
                transition={{ duration: 1.2, times: [0, 0.4, 1], ease: "easeOut" }}
                className="absolute w-12 h-12 rounded-full border border-white/60 bg-white/10 shadow-[0_0_24px_rgba(255,255,255,0.5)]"
            />

            {/* 2. Smaller Particle Splash radiating outward with gravity */}
            {particles.map((p) => {
                const targetX = Math.cos(p.angle) * p.distance;
                const targetY = Math.sin(p.angle) * p.distance - 20; // bias upward

                return (
                    <motion.div
                        key={p.id}
                        initial={{
                            x: 0,
                            y: 0,
                            scale: 0.2,
                            opacity: 1,
                            rotate: 0
                        }}
                        animate={{
                            x: [0, targetX * 0.75, targetX * 1.15],
                            y: [0, targetY * 0.7, targetY + 28], // gravity drop curve
                            scale: [0.2, p.scale * 1.3, 0],
                            opacity: [1, 1, 0.9, 0],
                            rotate: [0, p.rotation * 0.5, p.rotation]
                        }}
                        transition={{
                            duration: 1.4,
                            delay: p.delay,
                            times: [0, 0.45, 0.8, 1],
                            ease: "easeOut"
                        }}
                        className="absolute text-[18px] select-none filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                    >
                        {emoji}
                    </motion.div>
                );
            })}

            {/* 3. Hero Emoji: Pops up huge, springs, wobbles and floats away */}
            <motion.div
                initial={{ scale: 0, y: 10, rotate: 0, opacity: 1 }}
                animate={{
                    scale: [0, 2.4, 1.8, 1.6, 1.4, 0],
                    y: [10, -25, -55, -90, -135, -165],
                    rotate: [0, -14, 14, -8, 6, 0],
                    opacity: [1, 1, 1, 1, 0.85, 0]
                }}
                transition={{
                    duration: 1.6,
                    times: [0, 0.2, 0.45, 0.7, 0.88, 1],
                    ease: [0.175, 0.885, 0.32, 1.275]
                }}
                onAnimationComplete={() => onComplete?.()}
                className="text-[48px] select-none filter drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
            >
                {emoji}
            </motion.div>
        </div>
    );
}

export default ReactionSplash;
