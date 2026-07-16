import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HelpSection = ({ setShowHelp, showHelp, }: any) => {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all duration-300">
            <button
                onClick={() => setShowHelp(!showHelp)}
                className="w-full flex items-center justify-between p-4 text-xs font-black uppercase tracking-wider text-white hover:text-white transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-2">
                    <HelpCircle size={14} className="text-[#E85151]" />
                    <span>How to Play & Scoring</span>
                </div>
                {showHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <AnimatePresence initial={false}>
                {showHelp && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-4 pb-5 text-[11px] text-white space-y-4 border-t border-white/10 pt-4 overflow-hidden"
                    >
                        <div>
                            <p className="font-black text-white uppercase tracking-wider mb-1">Game Flow</p>
                            <p>You and your opponent answer the same 7 questions. Play live in real-time or challenge your friends asynchronously at your own pace.</p>
                        </div>
                        <div>
                            <p className="font-black text-white uppercase tracking-wider mb-1">Scoring System</p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li><strong className="text-[#E85151]">Correct answer</strong>: <strong className="text-white">11–20 points</strong> (decays based on speed).</li>
                                <li><strong className="text-[#E85151]">Round 7 (Final Round)</strong>: All points are <strong className="text-[#E85151]">DOUBLED</strong>!</li>
                            </ul>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default HelpSection