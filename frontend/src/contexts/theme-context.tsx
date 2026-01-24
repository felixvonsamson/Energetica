import {
    createContext,
    useContext,
    useLayoutEffect,
    useState,
    type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "auto";

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(() => {
        // Check localStorage first
        const stored = localStorage.getItem("theme") as Theme | null;
        if (
            stored &&
            (stored === "light" || stored === "dark" || stored === "auto")
        ) {
            return stored;
        }

        // Default to auto mode
        return "auto";
    });

    // Use useLayoutEffect to apply theme SYNCHRONOUSLY before other effects
    // This ensures the DOM class is updated before useAssetColorGetter tries to read CSS variables
    useLayoutEffect(() => {
        const root = document.documentElement;

        // Determine the actual theme to apply
        const resolvedTheme =
            theme === "auto"
                ? window.matchMedia("(prefers-color-scheme: dark)").matches
                    ? "dark"
                    : "light"
                : theme;

        // Apply theme to document
        root.classList.remove("light", "dark");
        root.classList.add(resolvedTheme);

        // Save to localStorage
        localStorage.setItem("theme", theme);

        // Listen for system preference changes when in auto mode
        if (theme === "auto") {
            const mediaQuery = window.matchMedia(
                "(prefers-color-scheme: dark)",
            );
            const handleChange = (e: MediaQueryListEvent) => {
                root.classList.remove("light", "dark");
                root.classList.add(e.matches ? "dark" : "light");
            };

            mediaQuery.addEventListener("change", handleChange);
            return () => mediaQuery.removeEventListener("change", handleChange);
        }
    }, [theme]);

    const toggleTheme = () => {
        setThemeState((prev) => {
            if (prev === "light") return "dark";
            if (prev === "dark") return "auto";
            return "light";
        });
    };

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within ThemeProvider");
    }
    return context;
}
