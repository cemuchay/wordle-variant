import { useEffect } from 'react';

interface KeyboardActions {
    onChar: (char: string) => void;
    onDelete: () => void;
    onEnter: () => void;
}

export const useKeyboard = (actions: KeyboardActions, isDisabled: boolean = false) => {
    useEffect(() => {
        if (isDisabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) return;
            const key = e.key.toUpperCase();

            if (key === 'ENTER') {
                actions.onEnter();
            } else if (key === 'BACKSPACE') {
                actions.onDelete();
            } else if (/^[A-Z]$/.test(key)) {
                actions.onChar(key);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [actions, isDisabled]);
};
