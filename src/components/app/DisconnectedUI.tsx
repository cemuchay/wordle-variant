const DisconnectedUI = ({ reconnectStatus, handleManualReconnect }: {
    reconnectStatus: "idle" | "attempting" | "failed", handleManualReconnect: () => void
}) => {
    return (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3 bg-amber-950/90 backdrop-blur-md border border-amber-500/30 px-4 py-2.5 rounded-2xl shadow-xl">
                <span className={`w-2 h-2 rounded-full ${reconnectStatus === "failed" ? "bg-red-500 animate-pulse" : "bg-amber-500 animate-ping"}`} />
                <p className="text-[10px] uppercase font-black tracking-wide text-amber-200">
                    {reconnectStatus === "attempting"
                        ? "Attempting to reconnect..."
                        : reconnectStatus === "failed"
                            ? "Live sync failed. Please refresh."
                            : "Live sync disconnected"}
                </p>
                <div className="flex items-center gap-2">
                    {reconnectStatus !== "attempting" && reconnectStatus !== "failed" && (
                        <button
                            onClick={handleManualReconnect}
                            className="bg-amber-500 hover:bg-amber-600 text-black px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            Reconnect
                        </button>
                    )}
                    {reconnectStatus === "failed" && (
                        <button
                            onClick={handleManualReconnect}
                            className="bg-amber-500/50 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            Retry
                        </button>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${reconnectStatus === "failed"
                            ? "bg-amber-500 hover:bg-amber-600 text-black animate-pulse"
                            : "bg-white/10 hover:bg-white/20 text-white"
                            }`}
                    >
                        Refresh
                    </button>
                </div>
            </div>
        </div>
    )
}

export default DisconnectedUI