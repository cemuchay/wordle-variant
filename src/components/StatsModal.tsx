
import { X } from 'lucide-react';

export const StatsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const stats = JSON.parse(localStorage.getItem('wordle-statistics') || '{"gamesPlayed":0,"gamesWon":0,"currentStreak":0,"maxStreak":0,"guesses":{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0}}');

  if (!isOpen) return null;

  const winPercentage = stats.gamesPlayed ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  const maxGuesses = Math.max(...Object.values(stats.guesses) as number[], 1);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
      <div className="bg-gray-900 border border-gray-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>
        
        <h2 className="text-xl font-black uppercase tracking-tighter mb-6 text-center">Statistics</h2>

        {/* High Level Stats */}
        <div className="flex justify-around mb-8 text-center">
          <div><div className="text-2xl font-black">{stats.gamesPlayed}</div><div className="text-[10px] uppercase text-gray-500">Played</div></div>
          <div><div className="text-2xl font-black">{winPercentage}%</div><div className="text-[10px] uppercase text-gray-500">Win %</div></div>
          <div><div className="text-2xl font-black">{stats.currentStreak}</div><div className="text-[10px] uppercase text-gray-500">Streak</div></div>
        </div>

        {/* Guess Distribution */}
        <h3 className="text-xs font-bold uppercase tracking-widest mb-4 text-gray-400">Guess Distribution</h3>
        <div className="space-y-2">
          {Object.entries(stats.guesses).map(([attempt, count]) => (
            <div key={attempt} className="flex items-center gap-2 text-xs font-mono">
              <span className="w-2">{attempt}</span>
              <div className="flex-1 bg-gray-800 rounded-sm overflow-hidden">
                <div 
                  className="bg-correct py-0.5 px-2 text-right transition-all duration-1000"
                  style={{ width: `${Math.max((count as number / maxGuesses) * 100, 8)}%` }}
                >
                  {count as number}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="mt-8 w-full bg-correct py-3 rounded-xl font-bold uppercase tracking-tighter hover:brightness-110 transition-all">Close</button>
      </div>
    </div>
  );
};