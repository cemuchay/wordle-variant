import { motion } from "framer-motion";

interface CountdownViewProps {
   countdownText: string;
}

export const CountdownView = ({ countdownText }: CountdownViewProps) => {
   return (
      <motion.div
         initial={{ scale: 0.8, opacity: 0 }}
         animate={{ scale: 1, opacity: 1 }}
         exit={{ scale: 1.5, opacity: 0 }}
         className="flex flex-col flex-1 justify-center items-center py-24"
      >
         <h3 className="text-xs text-gray-500 font-black uppercase tracking-widest mb-6">Battle Starts In</h3>
         <motion.h1
            key={countdownText}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-8xl font-black text-correct select-none font-mono"
         >
            {countdownText}
         </motion.h1>
      </motion.div>
   );
};
