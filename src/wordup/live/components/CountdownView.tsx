interface CountdownViewProps {
   countdownText: string;
}

export const CountdownView = ({ countdownText }: CountdownViewProps) => {
   const isResuming = countdownText.toLowerCase().includes("resum");
   const displayDigit = countdownText.replace(/^[^\d]*/, "").replace(/[^\d].*$/, "") || countdownText;

   return (
      <div className="flex flex-col flex-1 justify-center items-center py-24 select-none">
         <h3 className="text-xs sm:text-sm text-amber-400 font-black uppercase tracking-widest mb-6 animate-pulse">
            {isResuming ? "Resuming Paused Match" : "Battle Starts In"}
         </h3>
         <h1 className="text-8xl sm:text-9xl font-black text-[#E85151] font-mono tracking-tight drop-shadow-md">
            {displayDigit}
         </h1>
      </div>
   );
};
