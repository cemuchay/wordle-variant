import { ArrowLeft, ExternalLink, X } from "lucide-react";

const FloatingHeader = ({
    selectedGroupId, setSelectedGroupId, selectedGroupName, handleExpand, setIsOverlayOpen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
}: any) => {
    return (<div className="px-4 py-3 bg-gray-800/80 border-b border-gray-700/60 flex items-center justify-between shrink-0 -mx-3 -mt-3 mb-2">
        <div className="flex items-center gap-2">
            {selectedGroupId && (
                <button
                    onClick={() => setSelectedGroupId(null)}
                    className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
            )}
            <span className="text-xs font-black uppercase tracking-wider text-gray-100">
                {selectedGroupId ? selectedGroupName : "Conversations"}
            </span>
        </div>
        <div className="flex items-center gap-1.5">
            {selectedGroupId && (
                <button
                    onClick={handleExpand}
                    className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer"
                    title="Open full chat"
                >
                    <ExternalLink className="w-4.5 h-4.5" />
                </button>
            )}
            <button
                onClick={() => {
                    setIsOverlayOpen(false);
                    setSelectedGroupId(null);
                }}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700/50 transition-colors cursor-pointer"
            >
                <X className="w-4.5 h-4.5" />
            </button>
        </div>
    </div>)
}

export default FloatingHeader