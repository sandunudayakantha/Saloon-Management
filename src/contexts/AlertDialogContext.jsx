import React, { createContext, useContext, useState, useCallback } from 'react';

const AlertDialogContext = createContext();

export const useAlertDialog = () => {
    return useContext(AlertDialogContext);
};

export const AlertDialogProvider = ({ children }) => {
    const [dialog, setDialog] = useState({
        isOpen: false,
        title: '',
        description: '',
        confirmText: 'Confirm',
        onConfirm: () => {},
        onCancel: () => {},
    });

    const showDialog = useCallback((options) => {
        setDialog({
            isOpen: true,
            title: options.title,
            description: options.description,
            confirmText: options.confirmText || 'Confirm',
            onConfirm: () => {
                options.onConfirm();
                hideDialog();
            },
            onCancel: () => {
                if(options.onCancel) options.onCancel();
                hideDialog();
            },
        });
    }, []);

    const hideDialog = useCallback(() => {
        setDialog((prev) => ({ ...prev, isOpen: false }));
    }, []);

    const value = {
        dialog,
        showDialog,
        hideDialog,
    };

    return (
        <AlertDialogContext.Provider value={value}>
            {children}
        </AlertDialogContext.Provider>
    );
};