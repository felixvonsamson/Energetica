import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sidebar-menu-state";

interface MenuState {
    [key: string]: boolean;
}

/**
 * Hook to persist sidebar menu open/closed state in localStorage. Returns an
 * object with isOpen and setIsOpen functions for a given menu key.
 */
export function useSidebarMenuState(
    menuKey: string,
    defaultOpen: boolean,
): [boolean, (open: boolean) => void] {
    // Initialize state from localStorage or default
    const [isOpen, setIsOpenState] = useState<boolean>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed: MenuState = JSON.parse(stored);
                // Return stored value if it exists, otherwise use defaultOpen
                return parsed[menuKey] ?? defaultOpen;
            }
        } catch {
            // Ignore parse errors
        }
        return defaultOpen;
    });

    // Persist to localStorage whenever state changes
    const setIsOpen = useCallback(
        (open: boolean) => {
            setIsOpenState(open);

            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                const current: MenuState = stored ? JSON.parse(stored) : {};
                current[menuKey] = open;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
            } catch {
                // Ignore storage errors
            }
        },
        [menuKey],
    );

    // Update state when defaultOpen changes (e.g., when navigating to a route in this menu)
    useEffect(() => {
        if (defaultOpen && !isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsOpen(true);
        }
    }, [defaultOpen, isOpen, setIsOpen]);

    return [isOpen, setIsOpen];
}
