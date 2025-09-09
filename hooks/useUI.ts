import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';
type View = 'backlog' | 'today' | 'snoozed' | 'archive' | 'stats' | 'settings';
export type SortOption = 'manual' | 'days_passed';

export interface ConfirmationState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  confirmClass: string;
  onConfirm: () => void;
}

export const useUI = () => {
    const [view, setView] = useState<View>(() => {
        const savedView = localStorage.getItem('backlogView') as View;
        return savedView || 'backlog';
    });
    
    const [theme, setTheme] = useState<Theme>(() => {
        const savedTheme = localStorage.getItem('theme') as Theme;
        if (savedTheme) return savedTheme;
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    const [selectedTags, setSelectedTags] = useState<string[]>(() => JSON.parse(localStorage.getItem('selectedTags') || '[]'));
    const [isCompactView, setIsCompactView] = useState(false);
    const [sortOption, setSortOption] = useState<SortOption>('manual');
    const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
        isOpen: false, title: '', message: '', confirmText: 'Confirm',
        confirmClass: 'bg-indigo-600 hover:bg-indigo-700', onConfirm: () => {},
    });

    useEffect(() => { localStorage.setItem('backlogView', view); }, [view]);
    useEffect(() => { localStorage.setItem('selectedTags', JSON.stringify(selectedTags)); }, [selectedTags]);

    const closeConfirmationModal = () => setConfirmationState(prev => ({ ...prev, isOpen: false }));
    
    const requestConfirmation = useCallback((options: Omit<ConfirmationState, 'isOpen' | 'onConfirm'> & { onConfirm: () => void }) => {
        setConfirmationState({
            ...options,
            isOpen: true,
            onConfirm: () => {
                options.onConfirm();
                closeConfirmationModal();
            },
        });
    }, []);

    return {
        theme,
        view,
        isCompactView,
        sortOption,
        selectedTags,
        confirmationState,
        setTheme,
        setView,
        // FIX: The state setter is named setIsCompactView, but was not being exported correctly.
        setCompactView: setIsCompactView,
        setSortOption,
        setSelectedTags,
        closeConfirmationModal,
        requestConfirmation,
    };
};