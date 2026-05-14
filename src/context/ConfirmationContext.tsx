import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface ConfirmationOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: 'danger' | 'info';
}

interface ConfirmationContextType {
    ask: (options: ConfirmationOptions) => Promise<boolean>;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export const ConfirmationProvider = ({ children }: { children: ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmationOptions>({
        title: '',
        message: '',
    });
    const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

    const ask = useCallback((newOptions: ConfirmationOptions): Promise<boolean> => {
        setOptions(newOptions);
        setIsOpen(true);
        return new Promise((resolve) => {
            setResolver(() => resolve);
        });
    }, []);

    const handleConfirm = useCallback(() => {
        if (resolver) resolver(true);
        setIsOpen(false);
    }, [resolver]);

    const handleCancel = useCallback(() => {
        if (resolver) resolver(false);
        setIsOpen(false);
    }, [resolver]);

    return (
        <ConfirmationContext.Provider value={{ ask }}>
            {children}
            <ConfirmationModal
                isOpen={isOpen}
                onClose={handleCancel}
                onConfirm={handleConfirm}
                {...options}
            />
        </ConfirmationContext.Provider>
    );
};

export const useConfirmation = () => {
    const context = useContext(ConfirmationContext);
    if (!context) {
        throw new Error('useConfirmation must be used within a ConfirmationProvider');
    }
    return context;
};
