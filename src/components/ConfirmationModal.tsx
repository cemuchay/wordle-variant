import { X, AlertCircle } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: 'danger' | 'info';
}

export const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    type = 'info'
}: ConfirmationModalProps) => {
    if (!isOpen) return null;

    const isDanger = type === 'danger';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-sm bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-full ${isDanger ? 'bg-red-500/10 text-red-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                            <AlertCircle size={20} />
                        </div>
                        <h2 className="text-lg font-black text-white tracking-tight">{title}</h2>
                    </div>

                    <p className="text-sm text-gray-400 leading-relaxed mb-6">
                        {message}
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-800 text-gray-300 font-bold text-xs rounded-xl transition-all border border-gray-800 uppercase tracking-widest"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                            }}
                            className={`flex-1 py-2.5 font-black text-xs rounded-xl transition-all shadow-lg uppercase tracking-widest ${
                                isDanger 
                                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20' 
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'
                            }`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>

                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 hover:bg-gray-800 rounded-full transition-colors text-gray-500 hover:text-white"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};
