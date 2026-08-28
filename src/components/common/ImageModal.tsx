import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { useAppStore } from "../../store/useAppStore";
import { Z_INDEX } from "../../constants/ui";

export const ImageModal = () => {
    const previewImage = useAppStore(s => s.previewImage);
    const setPreviewImage = useAppStore(s => s.setPreviewImage);

    // Body scroll lock
    useEffect(() => {
        if (previewImage) {
            document.body.style.overflow = 'hidden';
            document.body.style.height = '100vh';
        } else {
            document.body.style.overflow = '';
            document.body.style.height = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.height = '';
        };
    }, [previewImage]);

    return (
        <AnimatePresence>
            {previewImage && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ zIndex: Z_INDEX.IMAGE_PREVIEW }}
                    className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-0 touch-none pointer-events-auto"
                    onClick={() => setPreviewImage(null)}
                >
                    {/* Header with Close Button */}
                    <div className="absolute top-0 left-0 right-0 p-6 flex justify-end pointer-events-none" style={{ zIndex: Z_INDEX.IMAGE_PREVIEW + 2 }}>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImage(null);
                            }}
                            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all cursor-pointer backdrop-blur-md border border-white/10 active:scale-90 pointer-events-auto shadow-2xl"
                        >
                            <X size={28} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Image Viewport */}
                    <div className="w-full h-full flex items-center justify-center p-2 sm:p-4">
                        <motion.img
                            key={previewImage}
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            src={previewImage}
                            className="max-w-full max-h-full object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] select-none pointer-events-none rounded-sm sm:rounded-lg"
                            alt="Full screen preview"
                        />
                    </div>

                    {/* Footer / Hint */}
                    <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none opacity-40">
                         <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Tap anywhere to close</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
