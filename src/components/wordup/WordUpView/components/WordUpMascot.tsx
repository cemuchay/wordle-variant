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

const KAOMOJI: Record<MascotExpression, string> = {
  idle: '(^-^)',
  thinking: '(?_?)',
  happy: '(^o^)',
  sad: '(;_;)',
  worried: '(>_<;)',
  excited: '\u3101(^o^)\u3039',
}

export const WordUpMascot = ({ expression, size = 120, className = '' }: WordUpMascotProps) => {
  const isExcited = expression === 'excited'
  const isHappy = expression === 'happy'
  const isSad = expression === 'sad'
  const isThinking = expression === 'thinking'
  const isWorried = expression === 'worried'

  return (
    <motion.div
      className={`inline-flex items-center justify-center select-none ${className}`}
      animate={
        isExcited
          ? { y: [0, -6, 0] }
          : isHappy
          ? { y: [0, -4, 0] }
          : isThinking
          ? { y: [0, -2, 0] }
          : isSad
          ? { rotate: [0, -3, 0, 3, 0] }
          : isWorried
          ? { rotate: [0, 2, -2, 0] }
          : {}
      }
      transition={
        isExcited
          ? { repeat: 5, duration: 0.35, ease: 'easeInOut' }
          : isHappy
          ? { repeat: 3, duration: 0.5, ease: 'easeInOut' }
          : isThinking
          ? { repeat: 2, duration: 3, ease: 'easeInOut' }
          : isSad
          ? { repeat: 3, duration: 2.5, ease: 'easeInOut' }
          : isWorried
          ? { repeat: 5, duration: 0.8, ease: 'easeInOut' }
          : undefined
      }
      style={{ minWidth: size, height: size, fontSize: size * 0.8, lineHeight: 1, width: 'auto' }}
    >
      <span className="inline-block leading-none" style={{ fontSize: '1em' }}>
        {KAOMOJI[expression]}
      </span>
    </motion.div>
  )
}
