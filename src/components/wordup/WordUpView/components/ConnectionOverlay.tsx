import { Clock } from "lucide-react";

interface ConnectionOverlayProps {
   realtimeStatus: string;
   view: string;
}

export const ConnectionOverlay = ({ realtimeStatus, view }: ConnectionOverlayProps) => {
   if (realtimeStatus !== "disconnected" || view !== "battle") return null;

   return (
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center z-50 p-6 text-center animate-in fade-in duration-200">
         <div className="bg-slate-900 border border-amber-500/30 p-6 rounded-3xl max-w-xs space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto animate-pulse">
               <Clock size={24} />
            </div>
            <h3 className="text-sm font-black uppercase text-amber-400 tracking-wider">Connection Lost</h3>
            <p className="text-[11px] text-gray-400 leading-relaxed">
               We lost sync with the battle arena. Hold tight while we attempt to reconnect you...
            </p>
         </div>
      </div>
   );
};
