interface ConnectingViewProps {
   message?: string;
}

export const ConnectingView = ({ message }: ConnectingViewProps) => {
   const isInvite = message === "Connecting to opponent...";
   return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[400px] p-6 text-center space-y-6">
         <div className="relative flex items-center justify-center">
            <div className="absolute w-24 h-24 rounded-full bg-correct/10 border border-correct/20 animate-ping opacity-25" />
            <div className="absolute w-16 h-16 rounded-full bg-correct/25 blur-xl animate-pulse" />

            <div className="relative p-6 bg-white/5 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md">
               <div className="w-9 h-9 border-4 border-correct border-t-transparent rounded-full animate-spin" />
            </div>
         </div>

         <div className="space-y-2 max-w-xs">
            <h3 className="text-xs font-black uppercase tracking-widest text-correct flex items-center justify-center gap-1.5">
               <span className="animate-pulse">{isInvite ? "⚔️" : "⚡"}</span>
               {isInvite ? "Opponent Found" : "Entering Arena"}
            </h3>
            <p className="text-sm font-bold text-white tracking-wide uppercase">
               {message || "Connecting to Server..."}
            </p>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">
               {isInvite ? "Starting match" : "Setting up match database"}
            </p>
         </div>
      </div>
   );
};

export default ConnectingView;
