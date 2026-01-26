import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserPreferences {
    repelForce: number;
    centerForce: number;
    linkDistance: number;
    showTags: boolean;
    focusOnHover: boolean;
}

export const DEFAULT_PREFS: UserPreferences = {
    repelForce: 4,
    centerForce: 0.3,
    linkDistance: 60,
    showTags: true,
    focusOnHover: true,
};

// Different defaults for Full screen if needed, but let's stick to one set for consistency
// Or we can let the view override? No, user controls these sliders.

interface GraphStore extends UserPreferences {
    setPref: (update: Partial<UserPreferences>) => void;
    resetPrefs: () => void;
    isSettingsOpen: boolean;
    toggleSettings: () => void;
    setIsSettingsOpen: (isOpen: boolean) => void;
}

export const useGraphStore = create<GraphStore>()(
    persist(
        (set) => ({
            ...DEFAULT_PREFS,
            setPref: (update) => set((state) => ({ ...state, ...update })),
            resetPrefs: () => set({ ...DEFAULT_PREFS }),
            isSettingsOpen: false,
            toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
            setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
        }),
        {
            name: 'graph-preferences',
            partialize: (state) => ({
                repelForce: state.repelForce,
                centerForce: state.centerForce,
                linkDistance: state.linkDistance,
                showTags: state.showTags,
                focusOnHover: state.focusOnHover,
            }),
        }
    )
);
