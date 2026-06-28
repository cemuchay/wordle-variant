import { memo } from 'react';

interface CreateStepIndicatorProps {
    steps: string[];
    currentStep: number;
}

export const CreateStepIndicator = memo(({ steps, currentStep }: CreateStepIndicatorProps) => {
    return (
        <div className="flex items-center gap-2 px-1">
            {steps.map((label, i) => (
                <div key={label} className="flex items-center gap-2 flex-1">
                    <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300
                            ${currentStep >= i ? 'bg-correct text-black shadow-lg shadow-correct/20' : 'bg-white/10 text-white/40'}`}
                        >
                            {currentStep > i ? '✓' : i + 1}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-wider hidden sm:block transition-colors
                            ${currentStep === i ? 'text-white' : 'text-white/40'}`}
                        >
                            {label}
                        </span>
                    </div>
                    {i < steps.length - 1 && (
                        <div className={`h-px flex-1 transition-colors ${currentStep > i ? 'bg-correct/50' : 'bg-white/10'}`} />
                    )}
                </div>
            ))}
        </div>
    );
});
