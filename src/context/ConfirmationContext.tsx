import { createContext, useContext } from 'react';

export interface ConfirmationOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: 'danger' | 'info';
}

export interface ConfirmationContextType {
    ask: (options: ConfirmationOptions) => Promise<boolean>;
}

export const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useConfirmation = () => {
    const context = useContext(ConfirmationContext);
    if (!context) {
        throw new Error('useConfirmation must be used within a ConfirmationProvider');
    }
    return context;
};
