import { createContext, useContext, useState, type ReactNode } from "react";

interface NavigationContextType {
    isMenuOpen: boolean;
    setIsMenuOpen: (open: boolean) => void;
    openDropdown: string | null;
    setOpenDropdown: (dropdown: string | null) => void;
    toggleDropdown: (dropdown: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(
    undefined,
);

export function NavigationProvider({ children }: { children: ReactNode }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const toggleDropdown = (dropdown: string) => {
        setOpenDropdown(openDropdown === dropdown ? null : dropdown);
    };

    return (
        <NavigationContext.Provider
            value={{
                isMenuOpen,
                setIsMenuOpen,
                openDropdown,
                setOpenDropdown,
                toggleDropdown,
            }}
        >
            {children}
        </NavigationContext.Provider>
    );
}

export function useNavigation() {
    const context = useContext(NavigationContext);
    if (context === undefined) {
        throw new Error(
            "useNavigation must be used within a NavigationProvider",
        );
    }
    return context;
}
