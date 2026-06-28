import { memo, useCallback, useRef, useEffect } from 'react';

interface CustomWordGridProps {
    mode: 'single' | 'marathon';
    wordLength?: number;
    value?: string;
    onChange?: (val: string) => void;
    marathonWords?: string[];
    marathonLengths?: number[];
    onMarathonChange?: (vals: string[]) => void;
}

function boxSizeClass(length: number) {
    if (length <= 6) return 'w-10 h-10 sm:w-11 sm:h-11 text-sm';
    if (length <= 8) return 'w-9 h-9 sm:w-10 sm:h-10 text-xs';
    if (length <= 10) return 'w-8 h-8 sm:w-9 sm:h-9 text-xs';
    return 'w-7 h-7 sm:w-8 sm:h-8 text-[10px]';
}

const LetterBox = memo(({ char, onChange, onKeyDown, inputRef, autoFocus, length }: {
    char: string;
    onChange: (val: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    inputRef?: (el: HTMLInputElement | null) => void;
    autoFocus?: boolean;
    length: number;
}) => (
    <input
        ref={inputRef}
        type="text"
        maxLength={1}
        value={char}
        onChange={(e) => {
            const val = e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase();
            onChange(val);
        }}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        className={`${boxSizeClass(length)} bg-black/40 border-2 border-white/20 rounded-lg text-center font-black uppercase text-white focus:border-correct/60 focus:bg-black/60 outline-none transition-all`}
    />
));

function WordRow({ length, value, onChange, rowIndex, autoFocus }: {
    length: number;
    value: string;
    onChange: (val: string) => void;
    rowIndex: number;
    autoFocus?: boolean;
}) {
    const refs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        refs.current = refs.current.slice(0, length);
    }, [length]);

    const setRef = useCallback((i: number) => (el: HTMLInputElement | null) => {
        refs.current[i] = el;
    }, []);

    const handleCharChange = useCallback((i: number, val: string) => {
        const chars = value.split('');
        chars[i] = val;
        onChange(chars.join(''));
        if (val && i < length - 1) {
            refs.current[i + 1]?.focus();
        }
    }, [value, onChange, length]);

    const handleKeyDown = useCallback((i: number) => (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !value[i] && i > 0) {
            refs.current[i - 1]?.focus();
        }
    }, [value]);

    const labelFont = length > 10 ? 'text-[9px]' : length > 8 ? 'text-[10px]' : 'text-[10px]';
    return (
        <div className="flex items-center gap-1.5">
            <span className={`${labelFont} text-white/60 font-bold tabular-nums w-8 shrink-0 text-right`}>
                #{rowIndex + 1}
            </span>
            {Array.from({ length }).map((_, i) => (
                <LetterBox
                    key={i}
                    length={length}
                    char={value[i] || ''}
                    onChange={(v) => handleCharChange(i, v)}
                    onKeyDown={handleKeyDown(i)}
                    inputRef={setRef(i)}
                    autoFocus={autoFocus && i === 0}
                />
            ))}
            <span className={`${labelFont} text-white/40 ml-1`}>{length}L</span>
        </div>
    );
}

export const CustomWordGrid = memo(({
    mode,
    wordLength = 5,
    value = '',
    onChange,
    marathonWords = [],
    marathonLengths = [],
    onMarathonChange,
}: CustomWordGridProps) => {
    if (mode === 'marathon') {
        return (
            <div className="space-y-2.5">
                {marathonLengths.map((len, idx) => (
                    <WordRow
                        key={idx}
                        length={len}
                        value={marathonWords[idx] || ''}
                        onChange={(val) => {
                            const next = [...marathonWords];
                            next[idx] = val;
                            onMarathonChange?.(next);
                        }}
                        rowIndex={idx}
                        autoFocus={idx === 0}
                    />
                ))}
            </div>
        );
    }

    return (
        <WordRow
            length={wordLength}
            value={value}
            onChange={(val) => onChange?.(val)}
            rowIndex={0}
            autoFocus
        />
    );
});
