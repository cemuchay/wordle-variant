import { Cloud, CloudCheck, CloudOff, Loader2, RefreshCw } from "lucide-react";
import type { SyncStatus } from "../types/game";

export function CloudSyncMenu({ status, onRetry }: { status: SyncStatus, onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1 rounded-full bg-secondary/50 text-xs font-medium">
      {status === 'syncing' && (
        <>
          <Loader2 className="w-3 h-2 animate-spin text-blue-500" />
          <span>Syncing to Cloud...</span>
        </>
      )}
      {status === 'synced' && (
        <>
          <CloudCheck className="w-3 h-3 text-green-500" />
          <span>Game Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <CloudOff className="w-3 h-3 text-red-500" />
          <span>Sync Failed</span>
          {onRetry && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="ml-1 p-1 hover:bg-white/10 rounded-full transition-colors text-blue-400"
              title="Retry Sync"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </>
      )}
      {status === 'idle' && (
        <>
          <Cloud className="w-3 h-3 opacity-50" />
          <span>Ready</span>
        </>
      )}
    </div>
  );
}