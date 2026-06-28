import { memo, useCallback, useRef, useEffect } from 'react';

interface MarathonTimerInputsProps {
    marathonGames: number[];
    marathonTimersInput: string[];
    marathonTimersArray: number[];
    timerType: 'same' | 'custom';
    setMarathonTimersInput: (fn: (prev: string[]) => string[]) => void;
    setMarathonTimersArray: (fn: (prev: number[]) => number[]) => void;
    isBotMarathon: boolean;
}

function MarathonTimerInputsInner({
    marathonGames,
    marathonTimersInput,
    timerType,
    setMarathonTimersInput,
    setMarathonTimersArray,
    isBotMarathon,
}: MarathonTimerInputsProps) {
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const persistTimer = useCallback((idx: number, val: number, lengths: number[]) => {
        if (!isBotMarathon) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            try {
                const raw = window.localStorage.getItem('wordle_daily_marathon_timers');
                const parsed = raw ? JSON.parse(raw) : {};
                parsed[idx] = { length: lengths[idx], timer: val };
                window.localStorage.setItem('wordle_daily_marathon_timers', JSON.stringify(parsed));
            } catch { /* noop */ }
        }, 300);
    }, [isBotMarathon]);

    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

    const handleChange = useCallback((idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setMarathonTimersInput(prev => { const next = [...prev]; next[idx] = val; return next; });
        const num = Number(val);
        if (!isNaN(num) && num >= 1 && num <= 60) {
            setMarathonTimersArray(prev => { const next = [...prev]; next[idx] = num; return next; });
            persistTimer(idx, num, marathonGames);
        }
    }, [setMarathonTimersInput, setMarathonTimersArray, persistTimer, marathonGames]);

    const handleBlur = useCallback((idx: number) => {
        setMarathonTimersInput(prev => {
            let num = parseInt(prev[idx], 10);
            if (isNaN(num)) num = 5; else if (num < 1) num = 1; else if (num > 60) num = 60;
            setMarathonTimersArray(prev => { const next = [...prev]; next[idx] = num; return next; });
            if (isBotMarathon) {
                if (debounceRef.current) clearTimeout(debounceRef.current);
                try {
                    const raw = window.localStorage.getItem('wordle_daily_marathon_timers');
                    const parsed = raw ? JSON.parse(raw) : {};
                    parsed[idx] = { length: marathonGames[idx], timer: num };
                    window.localStorage.setItem('wordle_daily_marathon_timers', JSON.stringify(parsed));
                } catch { /* noop */ }
            }
            const next = [...prev];
            next[idx] = String(num);
            return next;
        });
    }, [setMarathonTimersInput, setMarathonTimersArray, isBotMarathon, marathonGames]);

    if (timerType !== 'custom') return null;

    return (
        <div className="flex flex-wrap gap-2 pl-4 border-l border-white/10 animate-in slide-in-from-left duration-200">
            {marathonGames.map((l, idx) => (
                <div key={idx} className="space-y-1 min-w-[50px] flex-1">
                    <p className="text-[10px] font-black uppercase text-white/80 text-center">#{idx + 1} ({l}L)</p>
                    <input type="number" inputMode="numeric" min={1} max={60} value={marathonTimersInput[idx] || ''}
                        onChange={(e) => handleChange(idx, e)}
                        onBlur={() => handleBlur(idx)}
                        className="w-full bg-black/40 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-center focus:border-correct/60 focus:bg-black/60 outline-none text-white transition-all" />
                </div>
            ))}
        </div>
    );
}

export const MarathonTimerInputs = memo(MarathonTimerInputsInner);
