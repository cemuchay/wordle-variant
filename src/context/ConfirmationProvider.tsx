import { useCallback, useState, type ReactNode } from 'react';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ConfirmationContext, type ConfirmationOptions } from './ConfirmationContext';

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
