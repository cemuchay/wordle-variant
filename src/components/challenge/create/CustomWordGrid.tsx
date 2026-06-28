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

const LetterBox = memo(({ char, onChange, onKeyDown, inputRef, autoFocus, length, boxIndex }: {
    char: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    inputRef?: (el: HTMLInputElement | null) => void;
    autoFocus?: boolean;
    length: number;
    boxIndex: number;
}) => (
    <input
        ref={inputRef}
        type="text"
        maxLength={1}
        value={char}
        data-box-index={boxIndex}
        data-ref-index={boxIndex}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        className={`${boxSizeClass(length)} bg-black/40 border-2 border-white/20 rounded-lg text-center font-black uppercase text-white focus:border-correct/60 focus:bg-black/60 outline-none transition-all`}
    />
));

const WordRow = memo(({ length, value, onChange, rowIndex, autoFocus }: {
    length: number;
    value: string;
    onChange: (val: string) => void;
    rowIndex: number;
    autoFocus?: boolean;
}) => {
    const refs = useRef<(HTMLInputElement | null)[]>([]);
    const valueRef = useRef(value);
    valueRef.current = value;

    useEffect(() => {
        refs.current = refs.current.slice(0, length);
    }, [length]);

    const setRefFromIndex = useCallback((el: HTMLInputElement | null) => {
        if (el) {
            const idx = Number(el.dataset.refIndex);
            refs.current[idx] = el;
        }
    }, []);

    const handleBoxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase();
        const i = Number(e.currentTarget.dataset.boxIndex);
        const cur = valueRef.current;
        const chars = cur.split('');
        chars[i] = val;
        onChange(chars.join(''));
        if (val && i < length - 1) {
            refs.current[i + 1]?.focus();
        }
    }, [onChange, length]);

    const handleBoxKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Backspace') return;
        const i = Number(e.currentTarget.dataset.boxIndex);
        if (!valueRef.current[i] && i > 0) {
            refs.current[i - 1]?.focus();
        }
    }, []);

    const labelFont = length > 10 ? 'text-[9px]' : 'text-[10px]';
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
                    boxIndex={i}
                    onChange={handleBoxChange}
                    onKeyDown={handleBoxKeyDown}
                    inputRef={setRefFromIndex}
                    autoFocus={autoFocus && i === 0}
                />
            ))}
            <span className={`${labelFont} text-white/40 ml-1`}>{length}L</span>
        </div>
    );
});

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
