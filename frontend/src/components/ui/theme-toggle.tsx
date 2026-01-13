import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/classname-utils";

interface ThemeToggleProps {
    variant?: "icon-only" | "menu-item";
    className?: string;
    onClick?: () => void;
}

/** Toggle button for switching between light and dark mode. */
export function ThemeToggle({
    variant = "icon-only",
    className,
    onClick,
}: ThemeToggleProps) {
    const { theme, toggleTheme } = useTheme();

    const handleClick = () => {
        toggleTheme();
        onClick?.();
    };

    const icon =
        theme === "light" ? (
            <Moon className="w-5 h-5" />
        ) : (
            <Sun className="w-5 h-5" />
        );

    if (variant === "menu-item") {
        return (
            <button
                onClick={handleClick}
                className={cn(
                    "flex items-center gap-2 px-4 py-3 w-full",
                    "text-foreground",
                    "hover:bg-tan-hover dark:hover:bg-muted",
                    "transition-colors border-b border-border/50",
                    className,
                )}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
                {icon}
                <span>Toggle Theme</span>
            </button>
        );
    }

    return (
        <button
            onClick={handleClick}
            className={cn(
                "p-2 rounded-lg transition-colors",
                "hover:bg-pine/10 dark:hover:bg-white/10",
                "focus:outline-none focus:ring-2 focus:ring-pine dark:focus:ring-white",
                className,
            )}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
            {icon}
        </button>
    );
}
