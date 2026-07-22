const AppLoadingSkeleton = () => {
    return (<div className="h-dvh w-full flex flex-col bg-dark text-white p-4 justify-between animate-pulse select-none">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0 px-2 mt-2">
            <div className="w-8 h-8 rounded-full bg-white/10" />
            <div className="h-6 w-32 bg-white/10 rounded-lg" />
            <div className="flex gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/10" />
                <div className="w-8 h-8 rounded-lg bg-white/10" />
            </div>
        </div>

        {/* Board Grid Skeleton: a full unified pulsing block about the height of the grid */}
        <div className="flex-1 flex items-center justify-center min-h-0 py-8 w-full px-4">
            <div className="w-full max-w-[280px] sm:max-w-[320px] aspect-5/6 max-h-[350px] sm:max-h-[400px] bg-white/5 border border-white/10 rounded-3xl" />
        </div>

        {/* Keyboard Skeleton */}
        <div className="w-full max-w-lg mx-auto pb-[calc(0.75rem+env(safe-area-inset-bottom,0))] space-y-1.5 shrink-0 px-2">
            <div className="flex justify-center gap-1.5">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="h-12 flex-1 rounded bg-white/10" />
                ))}
            </div>
            <div className="flex justify-center gap-1.5 px-3">
                {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="h-12 flex-1 rounded bg-white/10" />
                ))}
            </div>
            <div className="flex justify-center gap-1.5">
                <div className="h-12 w-14 rounded bg-white/10" />
                {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="h-12 flex-1 rounded bg-white/10" />
                ))}
                <div className="h-12 w-14 rounded bg-white/10" />
            </div>
        </div>
    </div>)
}

export default AppLoadingSkeleton