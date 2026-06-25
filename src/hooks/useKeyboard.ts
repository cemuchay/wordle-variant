import { useEffect, useRef } from 'react';

interface KeyboardActions {
    onChar: (char: string) => void;
    onDelete: () => void;
    onEnter: () => void;
    onCursorLeft?: () => void;
    onCursorRight?: () => void;
}

export const useKeyboard = (actions: KeyboardActions, isDisabled: boolean = false) => {
    const actionsRef = useRef(actions);
    
    // Always keep the ref up to date with the latest actions
    useEffect(() => {
        actionsRef.current = actions;
    }, [actions]);

    useEffect(() => {
        if (isDisabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if focus is in an input or textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.ctrlKey || e.metaKey) return;
            const key = e.key.toUpperCase();

            if (key === 'ENTER') {
                actionsRef.current.onEnter();
            } else if (key === 'BACKSPACE') {
                actionsRef.current.onDelete();
            } else if (key === 'ARROWLEFT') {
                actionsRef.current.onCursorLeft?.();
            } else if (key === 'ARROWRIGHT') {
                actionsRef.current.onCursorRight?.();
            } else if (/^[A-Z]$/.test(key)) {
                actionsRef.current.onChar(key);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDisabled]);
};
