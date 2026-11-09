import { Clock } from "lucide-react";
import { MAX_POLL_DURATION_HOURS, formatDurationLabel } from "../../../../types/poll";

interface DurationSelectorProps {
   durationHours: number;
   onChange: (hours: number) => void;
}

const PRESETS = [
   { label: "1 Hour", hours: 1 },
   { label: "6 Hours", hours: 6 },
   { label: "12 Hours", hours: 12 },
   { label: "1 Day", hours: 24 },
   { label: "3 Days", hours: 72 },
   { label: "7 Days (Max)", hours: 168 },
];

export const DurationSelector = ({ durationHours, onChange }: DurationSelectorProps) => {
   return (
      <div className="space-y-2">
         <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1.5">
               <Clock size={12} className="text-indigo-400" />
               Poll Duration (Max 7 Days)
            </label>
            <span className="text-[10px] font-black text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-full">
               {formatDurationLabel(durationHours)}
            </span>
         </div>

         <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.map((preset) => {
               const active = durationHours === preset.hours;
               return (
                  <button
                     key={preset.hours}
                     type="button"
                     onClick={() => onChange(preset.hours)}
                     className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                        active
                           ? "bg-indigo-600 text-white border-indigo-400 shadow-sm"
                           : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"
                     }`}
                  >
                     {preset.label}
                  </button>
               );
            })}
         </div>

         {/* Custom Hours Slider / Input */}
         <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] text-gray-400 font-semibold shrink-0">Custom (hrs):</span>
            <input
               type="range"
               min={1}
               max={MAX_POLL_DURATION_HOURS}
               value={durationHours}
               onChange={(e) => onChange(Math.min(MAX_POLL_DURATION_HOURS, Math.max(1, Number(e.target.value))))}
               className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
            <input
               type="number"
               min={1}
               max={MAX_POLL_DURATION_HOURS}
               value={durationHours}
               onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val)) {
                     onChange(Math.min(MAX_POLL_DURATION_HOURS, Math.max(1, val)));
                  }
               }}
               className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-white text-center outline-none focus:border-indigo-400"
            />
         </div>
      </div>
   );
};
