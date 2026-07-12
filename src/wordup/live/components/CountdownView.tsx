interface CountdownViewProps {
   countdownText: string;
}

export const CountdownView = ({ countdownText }: CountdownViewProps) => {
   return (
      <div className="flex flex-col flex-1 justify-center items-center py-24">
         <h3 className="text-xs text-white/40 font-black uppercase tracking-widest mb-6">Battle Starts In</h3>
         <h1 className="text-8xl font-black text-[#E85151] select-none font-mono">
            {countdownText}
         </h1>
      </div>
   );
};
