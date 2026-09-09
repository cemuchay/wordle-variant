import { CloudUpload, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { memo } from 'react';
import type { PendingChallengeGame } from '../../utils/challengeQueueManager';

interface ChallengeSyncBannerProps {
  pendingGames: PendingChallengeGame[];
  isSyncing: boolean;
  onSync: () => void;
  isStuck?: boolean;
  onReset?: () => void;
}

export const ChallengeSyncBanner = memo(function ChallengeSyncBanner({
  pendingGames,
  isSyncing,
  onSync,
  isStuck = false,
  onReset,
}: ChallengeSyncBannerProps) {
  if (!pendingGames || pendingGames.length === 0) return null;

  const count = pendingGames.length;

  return (
    <div
      className={`${
        isStuck
          ? 'bg-red-500/10 border-red-500/30 shadow-red-500/5'
          : 'bg-amber-500/10 border-amber-500/25 shadow-amber-500/5'
      } border rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg transition-all`}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div
          className={`p-2 rounded-xl ${
            isStuck ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
          } shrink-0 flex items-center justify-center`}
        >
          {isStuck ? (
            <AlertTriangle className="w-5 h-5 animate-pulse text-red-400" />
          ) : (
            <CloudUpload className="w-5 h-5 animate-pulse" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h4
              className={`text-xs sm:text-sm font-black uppercase tracking-tight ${
                isStuck ? 'text-red-400' : 'text-amber-300'
              }`}
            >
              {isStuck
                ? 'Sync Stuck / Conflicted'
                : count === 1
                ? '1 Unsynced Game Update'
                : `${count} Unsynced Game Updates`}
            </h4>
            <span className="flex h-2 w-2 relative">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isStuck ? 'bg-red-400' : 'bg-amber-400'
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isStuck ? 'bg-red-500' : 'bg-amber-500'
                }`}
              ></span>
            </span>
          </div>
          <p className={`text-[11px] truncate ${isStuck ? 'text-red-200/80' : 'text-amber-200/70'}`}>
            {isStuck
              ? 'Local cache is out of sync with cloud. Resetting cache is recommended.'
              : 'Completed offline or awaiting upload to the server.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
        {isStuck && onReset && (
          <button
            onClick={onReset}
            type="button"
            className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            title="Clear Stale Cache & Reload"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Cache</span>
          </button>
        )}
        <button
          onClick={onSync}
          disabled={isSyncing}
          type="button"
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl ${
            isStuck
              ? 'bg-gray-800 hover:bg-gray-700 text-white'
              : 'bg-amber-500 hover:bg-amber-400 text-black'
          } active:scale-95 disabled:opacity-50 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed shadow-md`}
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <CloudUpload className="w-4 h-4" />
              <span>Retry Sync</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
});
