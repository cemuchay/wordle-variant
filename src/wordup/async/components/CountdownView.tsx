interface CountdownViewProps {
   countdownText: string;
}

export const CountdownView = ({ countdownText }: CountdownViewProps) => {
   return (
      <div className="flex flex-col flex-1 justify-center items-center py-24">
         <h3 className="text-xs text-gray-500 font-black uppercase tracking-widest mb-6">Match Starts In</h3>
         <h1 className="text-8xl font-black text-correct select-none font-mono">
            {countdownText}
         </h1>
      </div>
   );
};
