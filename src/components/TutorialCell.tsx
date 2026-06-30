import { motion } from 'framer-motion';

interface TutorialCellProps {
  letter: string;
  status: 'correct' | 'present' | 'absent' | 'empty' | 'default';
  small?: boolean;
  delay?: number;
}

export const TutorialCell = ({ letter, status, small = false, delay = 0 }: TutorialCellProps) => {
  let statusClass = 'border-gray-800';
  if (status === 'correct') statusClass = 'bg-correct border-correct text-white';
  else if (status === 'present') statusClass = 'bg-present border-present text-white';
  else if (status === 'absent') statusClass = 'bg-absent border-absent text-white';
  else if (status === 'default') statusClass = 'border-gray-500';

  const size = small ? 'w-7 h-7 text-[10px] rounded-sm' : 'w-10 h-10 text-lg rounded-md';

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, delay, ease: 'easeOut' }}
      className={`flex items-center justify-center font-bold uppercase border-2 ${size} ${statusClass}`}
    >
      {letter}
    </motion.div>
  );
};
