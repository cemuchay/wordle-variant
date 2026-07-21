import { X } from "lucide-react"


const ShowScoringInfo = ({ showScoringInfo, setShowScoringInfo }: { showScoringInfo: boolean, setShowScoringInfo: React.Dispatch<React.SetStateAction<boolean>> }) => {
    return (
        <>
            {
                showScoringInfo && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={() => setShowScoringInfo(false)}>
                        <div className="bg-gray-950 border border-gray-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative max-h-[80vh] overflow-y-auto flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => setShowScoringInfo(false)}
                                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>

                            <h2 className="text-sm font-black uppercase tracking-wider text-indigo-400 mb-4 border-b border-gray-800 pb-2">
                                Variant Skill Index Scoring System
                            </h2>

                            <div className="space-y-5 text-[11px] leading-relaxed text-gray-300">
                                {/* Point values */}
                                <div>
                                    <h3 className="font-bold text-gray-200 uppercase tracking-tight text-[10px] mb-2 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-correct inline-block"></span>
                                        Standard Tile Rewards
                                    </h3>
                                    <p className="text-gray-400 mb-2">Points awarded for first-time discovery of a letter (based on attempt row):</p>
                                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-white/5 p-2 rounded-xl border border-white/5 font-mono">
                                        <div>
                                            <p className="text-correct font-bold border-b border-white/5 pb-1 uppercase">GREEN (CORRECT)</p>
                                            <p className="pt-1">Row 1: +65</p>
                                            <p>Row 2: +55</p>
                                            <p>Row 3: +45</p>
                                            <p>Row 4: +35</p>
                                            <p>Row 5: +25</p>
                                            <p>Row 6: +20</p>
                                        </div>
                                        <div className="border-l border-white/5 pl-2">
                                            <p className="text-present font-bold border-b border-white/5 pb-1 uppercase">YELLOW (PRESENT)</p>
                                            <p className="pt-1">Row 1: +50</p>
                                            <p>Row 2: +40</p>
                                            <p>Row 3: +30</p>
                                            <p>Row 4: +20</p>
                                            <p>Row 5: +15</p>
                                            <p>Row 6: +10</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Regression rules */}
                                <div>
                                    <h3 className="font-bold text-gray-200 uppercase tracking-tight text-[10px] mb-2 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"></span>
                                        Tactical Regression Penalties
                                    </h3>
                                    <p className="text-gray-400 mb-2">Penalties applied for playing worse than previous guesses (omitting/moving solved letters):</p>
                                    <div className="space-y-3">
                                        <div className="bg-red-950/20 border border-red-500/15 p-2.5 rounded-xl">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-black text-[9px] uppercase tracking-wide text-red-300">Green to Black</span>
                                                <span className="font-mono text-red-400 font-bold">-15 pts</span>
                                            </div>
                                            <p className="text-gray-400 text-[10px]">Omitting/removing a solved Green letter from its correct spot in a later guess.</p>
                                            <div className="mt-1.5 flex gap-1 items-center font-mono text-[9px]">
                                                <span className="text-gray-500">Row 1:</span>
                                                <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">T</span>
                                                <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">O</span>
                                                <span className="bg-correct text-white px-1 py-0.5 rounded">T</span>
                                                <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">H</span>
                                                <span className="text-gray-500 mx-1">→</span>
                                                <span className="text-gray-500">Row 2:</span>
                                                <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">C</span>
                                                <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">L</span>
                                                <span className="bg-gray-850 text-gray-600 px-1 py-0.5 rounded border border-gray-750 font-bold">O</span>
                                                <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">N</span>
                                                <span className="text-red-400 font-bold ml-1">(T is lost)</span>
                                            </div>
                                        </div>

                                        <div className="bg-red-950/20 border border-red-500/15 p-2.5 rounded-xl">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-black text-[9px] uppercase tracking-wide text-red-300">Yellow to Black</span>
                                                <span className="font-mono text-red-400 font-bold">-10 pts</span>
                                            </div>
                                            <p className="text-gray-400 text-[10px]">Completely omitting a previously found Yellow (present) letter in a subsequent guess.</p>
                                            <div className="mt-1.5 flex gap-1 items-center font-mono text-[9px]">
                                                <span className="text-gray-500">Row 1:</span>
                                                <span className="bg-present text-white px-1 py-0.5 rounded">A</span>
                                                <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">B</span>
                                                <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">U</span>
                                                <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">S</span>
                                                <span className="text-gray-500 mx-1">→</span>
                                                <span className="text-gray-500">Row 2:</span>
                                                <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">C</span>
                                                <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">L</span>
                                                <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">O</span>
                                                <span className="bg-gray-800 text-gray-400 px-1 py-0.5 rounded border border-gray-750">N</span>
                                                <span className="text-red-400 font-bold ml-1">(A is missing)</span>
                                            </div>
                                        </div>

                                        <div className="bg-red-950/20 border border-red-500/15 p-2.5 rounded-xl">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-black text-[9px] uppercase tracking-wide text-red-300">Green to Yellow</span>
                                                <span className="font-mono text-red-400 font-bold">-5 pts</span>
                                            </div>
                                            <p className="text-gray-400 text-[10px]">Moving a previously solved Green letter out of its correct spot into a Yellow (present) spot.</p>
                                        </div>

                                        <div className="bg-red-950/20 border border-red-500/15 p-2.5 rounded-xl">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-black text-[9px] uppercase tracking-wide text-red-300">Yellow Same Spot</span>
                                                <span className="font-mono text-red-400 font-bold">-5 pts</span>
                                            </div>
                                            <p className="text-gray-400 text-[10px]">Guessing a Yellow letter in the exact same wrong spot again, wasting a guess.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowScoringInfo(false)}
                                className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer"
                            >
                                Got It
                            </button>
                        </div>
                    </div>
                )}
        </>
    )
}

export default ShowScoringInfo