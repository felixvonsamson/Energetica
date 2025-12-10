import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/cn";

interface ThemeToggleProps {
    className?: string;
}

/** Toggle button for switching between light and dark mode. */
export function ThemeToggle({ className }: ThemeToggleProps) {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={cn(
                "p-2 rounded-lg transition-colors",
                "hover:bg-pine/10 dark:hover:bg-white/10",
                "focus:outline-none focus:ring-2 focus:ring-pine dark:focus:ring-white",
                className,
            )}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
            {theme === "light" ? (
                <Moon className="w-5 h-5" />
            ) : (
                <Sun className="w-5 h-5" />
            )}
        </button>
    );
}
