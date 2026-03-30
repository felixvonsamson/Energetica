import { Moon, Sun, SunMoon } from "lucide-react";
import { forwardRef } from "react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";

interface ThemeToggleProps extends React.ComponentPropsWithoutRef<"button"> {
    variant?: "icon-only" | "menu-item";
}

/** Toggle button for switching between light, dark, and auto mode. */
export const ThemeToggle = forwardRef<HTMLButtonElement, ThemeToggleProps>(
    ({ variant = "icon-only", className, onClick, ...props }, ref) => {
        const { theme, toggleTheme } = useTheme();

        const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            toggleTheme();
            onClick?.(e);
        };

        const icon =
            theme === "light" ? (
                <Sun size={20} />
            ) : theme === "dark" ? (
                <Moon size={20} />
            ) : (
                <SunMoon size={20} />
            );

        const nextTheme =
            theme === "light" ? "dark" : theme === "dark" ? "auto" : "light";

        if (variant === "menu-item") {
            return (
                <button
                    ref={ref}
                    onClick={handleClick}
                    className={cn("flex items-center gap-2 w-full", className)}
                    aria-label={`Switch to ${nextTheme} mode`}
                    {...props}
                >
                    {icon}
                    <span>Toggle Theme</span>
                </button>
            );
        }

        return (
            <Button
                ref={ref}
                onClick={handleClick}
                variant="outline"
                size="icon"
                className={className}
                aria-label={`Switch to ${nextTheme} mode`}
                {...props}
            >
                {icon}
            </Button>
        );
    },
);

ThemeToggle.displayName = "ThemeToggle";
