import { motion } from 'framer-motion'

export type MascotExpression = 'idle' | 'thinking' | 'happy' | 'sad' | 'worried' | 'excited'

export interface MascotEventDetail {
  expression: MascotExpression
  label: string
}

interface WordUpMascotProps {
  expression: MascotExpression
  size?: number
  className?: string
}

const FACE_STROKE = '#E8B830'

const accent: Record<MascotExpression, { color: string; shadow: string }> = {
  idle: { color: '#2d5a27', shadow: '#1a3a17' },
  thinking: { color: '#b45309', shadow: '#78350f' },
  happy: { color: '#2d5a27', shadow: '#1a3a17' },
  sad: { color: '#1e40af', shadow: '#1e3a8a' },
  worried: { color: '#c2410c', shadow: '#9a3412' },
  excited: { color: '#2d5a27', shadow: '#1a3a17' },
}

export const WordUpMascot = ({ expression, size = 120, className = '' }: WordUpMascotProps) => {
  const a = accent[expression]
  const cx = 40
  const cy = 40
  const r = 26
  const eyeSpacing = 16
  const eyeY = cy - 4

  const isExcited = expression === 'excited'
  const isHappy = expression === 'happy'
  const isSad = expression === 'sad'
  const isThinking = expression === 'thinking'
  const isWorried = expression === 'worried'

  return (
    <motion.div
      className={`inline-flex items-center justify-center ${className}`}
      animate={
        isExcited
          ? { y: [0, -6, 0] }
          : isHappy
          ? { y: [0, -4, 0] }
          : isThinking
          ? { y: [0, -2, 0] }
          : {}
      }
      transition={
        isExcited
          ? { repeat: Infinity, duration: 0.35, ease: 'easeInOut' }
          : isHappy
          ? { repeat: Infinity, duration: 0.5, ease: 'easeInOut' }
          : isThinking
          ? { repeat: Infinity, duration: 3, ease: 'easeInOut' }
          : undefined
      }
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`face-grad`} cx="40%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#FFE666" />
            <stop offset="100%" stopColor="#FFD93D" />
          </radialGradient>
          <radialGradient id={`shine`} cx="35%" cy="28%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.45" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <filter id={`glow`}>
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.12" />
          </filter>
        </defs>

        <motion.g
          animate={
            isExcited
              ? { scale: [1, 1.06, 1], transition: { repeat: Infinity, duration: 0.35, ease: 'easeInOut' } }
              : isHappy
              ? { scale: [1, 1.04, 1], transition: { repeat: Infinity, duration: 0.5, ease: 'easeInOut' } }
              : isSad
              ? { rotate: [0, -4, 0, 4, 0], transition: { repeat: Infinity, duration: 2.5, ease: 'easeInOut' } }
              : isWorried
              ? { rotate: [0, 3, -3, 0], transition: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } }
              : {}
          }
          filter="url(#glow)"
        >
          {/* Face */}
          <circle cx={cx} cy={cy} r={r} fill="url(#face-grad)" stroke={FACE_STROKE} strokeWidth={2.5} />
          <circle cx={cx} cy={cy} r={r} fill="url(#shine)" />

          {/* Eyes */}
          {isHappy || isExcited ? (
            <g>
              {/* Left eye - closed happy */}
              <path
                d={`M ${cx - eyeSpacing - 5} ${eyeY + 1} Q ${cx - eyeSpacing} ${eyeY - 6} ${cx - eyeSpacing + 5} ${eyeY + 1}`}
                stroke={a.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
              {/* Right eye - closed happy */}
              <path
                d={`M ${cx + eyeSpacing - 5} ${eyeY + 1} Q ${cx + eyeSpacing} ${eyeY - 6} ${cx + eyeSpacing + 5} ${eyeY + 1}`}
                stroke={a.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
              {/* Eyelashes left */}
              <path d={`M ${cx - eyeSpacing - 5} ${eyeY + 1} L ${cx - eyeSpacing - 8} ${eyeY + 4}`} stroke={a.color} strokeWidth={1.5} strokeLinecap="round" />
              <path d={`M ${cx - eyeSpacing} ${eyeY - 3} L ${cx - eyeSpacing - 2} ${eyeY - 7}`} stroke={a.color} strokeWidth={1.5} strokeLinecap="round" />
              {/* Eyelashes right */}
              <path d={`M ${cx + eyeSpacing + 5} ${eyeY + 1} L ${cx + eyeSpacing + 8} ${eyeY + 4}`} stroke={a.color} strokeWidth={1.5} strokeLinecap="round" />
              <path d={`M ${cx + eyeSpacing} ${eyeY - 3} L ${cx + eyeSpacing + 2} ${eyeY - 7}`} stroke={a.color} strokeWidth={1.5} strokeLinecap="round" />

              {/* Star eyes (excited only) */}
              {isExcited && (
                <g>
                  {([cx - eyeSpacing, cx + eyeSpacing] as const).map((ex, i) => (
                    <g key={i}>
                      <path
                        d={`M ${ex} ${eyeY - 7} Q ${ex} ${eyeY - 3} ${ex + 4} ${eyeY - 3} Q ${ex} ${eyeY - 3} ${ex} ${eyeY + 1} Q ${ex} ${eyeY - 3} ${ex - 4} ${eyeY - 3} Q ${ex} ${eyeY - 3} ${ex} ${eyeY - 7} Z`}
                        fill={a.color}
                        opacity={0.6}
                      />
                    </g>
                  ))}
                </g>
              )}
            </g>
          ) : isSad ? (
            <g>
              {/* Left eye */}
              <ellipse cx={cx - eyeSpacing} cy={eyeY} rx={5} ry={5.5} fill="white" stroke={a.color} strokeWidth={2} />
              <ellipse cx={cx - eyeSpacing} cy={eyeY} rx={3} ry={3.5} fill={a.color} />
              <circle cx={cx - eyeSpacing - 1.5} cy={eyeY - 2} r={1.2} fill="white" />
              {/* Right eye */}
              <ellipse cx={cx + eyeSpacing} cy={eyeY} rx={5} ry={5.5} fill="white" stroke={a.color} strokeWidth={2} />
              <ellipse cx={cx + eyeSpacing} cy={eyeY} rx={3} ry={3.5} fill={a.color} />
              <circle cx={cx + eyeSpacing - 1.5} cy={eyeY - 2} r={1.2} fill="white" />
            </g>
          ) : isWorried ? (
            <g>
              {/* Left eye - wide/shake */}
              <motion.g animate={{ x: [0, 1, -1, 0] }} transition={{ repeat: Infinity, duration: 0.6 }}>
                <ellipse cx={cx - eyeSpacing} cy={eyeY} rx={6} ry={4.5} fill="white" stroke={a.color} strokeWidth={2} />
                <ellipse cx={cx - eyeSpacing} cy={eyeY} rx={3.5} ry={2.5} fill={a.color} />
                <circle cx={cx - eyeSpacing - 1.5} cy={eyeY - 1.5} r={1} fill="white" />
              </motion.g>
              {/* Right eye - wide/shake */}
              <motion.g animate={{ x: [0, -1, 1, 0] }} transition={{ repeat: Infinity, duration: 0.6 }}>
                <ellipse cx={cx + eyeSpacing} cy={eyeY} rx={6} ry={4.5} fill="white" stroke={a.color} strokeWidth={2} />
                <ellipse cx={cx + eyeSpacing} cy={eyeY} rx={3.5} ry={2.5} fill={a.color} />
                <circle cx={cx + eyeSpacing - 1.5} cy={eyeY - 1.5} r={1} fill="white" />
              </motion.g>
            </g>
          ) : isThinking ? (
            <g>
              {/* Left eye - half-lidded */}
              <path d={`M ${cx - eyeSpacing - 5} ${eyeY} A 5 5 0 0 1 ${cx - eyeSpacing + 5} ${eyeY}`} fill="white" stroke={a.color} strokeWidth={2} />
              <line x1={cx - eyeSpacing - 5} y1={eyeY} x2={cx - eyeSpacing + 5} y2={eyeY} stroke={a.color} strokeWidth={2} />
              <circle cx={cx - eyeSpacing} cy={eyeY + 1} r={2.5} fill={a.color} />
              {/* Right eye - looking up */}
              <path d={`M ${cx + eyeSpacing - 5} ${eyeY} A 5 5 0 0 1 ${cx + eyeSpacing + 5} ${eyeY}`} fill="white" stroke={a.color} strokeWidth={2} />
              <line x1={cx + eyeSpacing - 5} y1={eyeY} x2={cx + eyeSpacing + 5} y2={eyeY} stroke={a.color} strokeWidth={2} />
              <circle cx={cx + eyeSpacing} cy={eyeY - 2} r={2} fill={a.color} />
            </g>
          ) : (
            <g>
              {/* Open eyes */}
              <g>
                <ellipse cx={cx - eyeSpacing} cy={eyeY} rx={4.5} ry={4.5} fill="white" stroke={a.color} strokeWidth={2} />
                <ellipse cx={cx - eyeSpacing} cy={eyeY} rx={2.5} ry={2.5} fill={a.color} />
                <circle cx={cx - eyeSpacing - 1.5} cy={eyeY - 1.5} r={1} fill="white" />
                <ellipse cx={cx + eyeSpacing} cy={eyeY} rx={4.5} ry={4.5} fill="white" stroke={a.color} strokeWidth={2} />
                <ellipse cx={cx + eyeSpacing} cy={eyeY} rx={2.5} ry={2.5} fill={a.color} />
                <circle cx={cx + eyeSpacing - 1.5} cy={eyeY - 1.5} r={1} fill="white" />
              </g>
              {/* Closed eyes (blink) */}
              <motion.g
                animate={{ opacity: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0] }}
                transition={{ repeat: Infinity, duration: 3, times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.86, 0.88, 0.9, 1] }}
              >
                <line x1={cx - eyeSpacing - 4.5} y1={eyeY} x2={cx - eyeSpacing + 4.5} y2={eyeY} stroke={a.color} strokeWidth={2.5} strokeLinecap="round" />
                <line x1={cx + eyeSpacing - 4.5} y1={eyeY} x2={cx + eyeSpacing + 4.5} y2={eyeY} stroke={a.color} strokeWidth={2.5} strokeLinecap="round" />
              </motion.g>
            </g>
          )}

          {/* Blush (happy/excited) */}
          {(isHappy || isExcited) && (
            <g opacity={0.3}>
              <ellipse cx={cx - eyeSpacing - 7} cy={eyeY + 9} rx={5} ry={3} fill="#FF6B6B" />
              <ellipse cx={cx + eyeSpacing + 7} cy={eyeY + 9} rx={5} ry={3} fill="#FF6B6B" />
            </g>
          )}

          {/* Mouth */}
          <g>
            {isHappy ? (
              <path
                d={`M ${cx - 9} ${cy + 9} Q ${cx} ${cy + 18} ${cx + 9} ${cy + 9}`}
                stroke={a.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
            ) : isExcited ? (
              <motion.g
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 0.35, ease: 'easeInOut' }}
              >
                <ellipse cx={cx} cy={cy + 11} rx={7} ry={6} fill={a.color} opacity={0.15} stroke={a.color} strokeWidth={2} />
                <ellipse cx={cx} cy={cy + 9} rx={5} ry={4} fill="#1a1a2e" />
              </motion.g>
            ) : isSad ? (
              <path
                d={`M ${cx - 8} ${cy + 8} Q ${cx} ${cy + 3} ${cx + 8} ${cy + 8}`}
                stroke={a.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
            ) : isWorried ? (
              <path
                d={`M ${cx - 7} ${cy + 9} Q ${cx - 3} ${cy + 11} ${cx} ${cy + 9} Q ${cx + 3} ${cy + 7} ${cx + 7} ${cy + 9}`}
                stroke={a.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ) : isThinking ? (
              <ellipse cx={cx} cy={cy + 9} rx={3} ry={2.5} stroke={a.color} strokeWidth={2} fill="none" />
            ) : (
              <path
                d={`M ${cx - 6} ${cy + 7} Q ${cx} ${cy + 11} ${cx + 6} ${cy + 7}`}
                stroke={a.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
            )}
          </g>

          {/* Accessories */}
          {/* Tears for sad */}
          {isSad && (
            <g>
              {([-1, 1] as const).map((side) => (
                <motion.g
                  key={side}
                  animate={{ y: [0, 5, 10], opacity: [0.8, 0.4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, delay: side === 1 ? 0.3 : 0, ease: 'easeIn' }}
                >
                  <path
                    d={`M ${cx + side * (eyeSpacing + 2)} ${eyeY + 7} Q ${cx + side * (eyeSpacing + 3)} ${eyeY + 12} ${cx + side * (eyeSpacing + 2)} ${eyeY + 14} Q ${cx + side * (eyeSpacing + 1)} ${eyeY + 12} ${cx + side * (eyeSpacing + 2)} ${eyeY + 7} Z`}
                    fill="#60a5fa"
                    opacity={0.7}
                  />
                </motion.g>
              ))}
            </g>
          )}

          {/* Sweat drop for worried */}
          {isWorried && (
            <motion.g
              animate={{ rotate: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{ transformOrigin: '58px 24px' }}
            >
              <path
                d="M 58 22 Q 62 28 58 31 Q 54 28 58 22 Z"
                fill="#60a5fa"
                opacity={0.6}
              />
              <ellipse cx={58} cy={22} rx={1.5} ry={1} fill="white" opacity={0.8} />
            </motion.g>
          )}

          {/* Sparkles for excited */}
          {isExcited && (
            <g opacity={0.7}>
              {[0, 1, 2].map((i) => (
                <motion.g
                  key={i}
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], rotate: [0, 45, 0] }}
                  transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.25, ease: 'easeInOut' }}
                >
                  <path
                    d={`M ${[62, 14, 58][i]} ${[18, 28, 65][i] - 6} Q ${[62, 14, 58][i]} ${[18, 28, 65][i]} ${[62, 14, 58][i] + 4} ${[18, 28, 65][i]} Q ${[62, 14, 58][i]} ${[18, 28, 65][i]} ${[62, 14, 58][i]} ${[18, 28, 65][i] + 6} Q ${[62, 14, 58][i]} ${[18, 28, 65][i]} ${[62, 14, 58][i] - 4} ${[18, 28, 65][i]} Q ${[62, 14, 58][i]} ${[18, 28, 65][i]} ${[62, 14, 58][i]} ${[18, 28, 65][i] - 6} Z`}
                    fill="#FFD93D"
                  />
                </motion.g>
              ))}
            </g>
          )}

          {/* Thought bubbles for thinking */}
          {isThinking && (
            <g opacity={0.6}>
              <motion.circle
                cx={56} cy={eyeY + 8}
                r={3} fill={a.color}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
              />
              <motion.circle
                cx={63} cy={eyeY + 12}
                r={2} fill={a.color}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 2, delay: 1 }}
              />
              <motion.circle
                cx={68} cy={eyeY + 15}
                r={1.5} fill={a.color}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 2, delay: 1.5 }}
              />
            </g>
          )}
        </motion.g>
      </svg>
    </motion.div>
  )
}
