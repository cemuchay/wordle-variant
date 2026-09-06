import { CloudUpload, Loader2 } from 'lucide-react';
import { memo } from 'react';
import type { PendingChallengeGame } from '../../utils/challengeQueueManager';

interface ChallengeSyncBannerProps {
  pendingGames: PendingChallengeGame[];
  isSyncing: boolean;
  onSync: () => void;
}

export const ChallengeSyncBanner = memo(function ChallengeSyncBanner({
  pendingGames,
  isSyncing,
  onSync,
}: ChallengeSyncBannerProps) {
  if (!pendingGames || pendingGames.length === 0) return null;

  const count = pendingGames.length;

  return (
    <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-amber-500/5 transition-all">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 flex items-center justify-center">
          <CloudUpload className="w-5 h-5 animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-tight">
              {count === 1 ? '1 Unsynced Game Update' : `${count} Unsynced Game Updates`}
            </h4>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          </div>
          <p className="text-[11px] text-amber-200/70 truncate">
            Completed offline or awaiting upload to the server.
          </p>
        </div>
      </div>

      <button
        onClick={onSync}
        disabled={isSyncing}
        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-md shadow-amber-500/20"
      >
        {isSyncing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Syncing...</span>
          </>
        ) : (
          <>
            <CloudUpload className="w-4 h-4" />
            <span>Upload Now</span>
          </>
        )}
      </button>
    </div>
  );
});
