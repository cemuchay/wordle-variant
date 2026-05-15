import { Cloud, CloudCheck, CloudOff, Loader2 } from "lucide-react";
import type { SyncStatus } from "../types/game";

export function CloudSyncMenu({ status }: { status: SyncStatus }) {
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