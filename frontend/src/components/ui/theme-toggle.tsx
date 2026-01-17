import { Moon, Sun } from "lucide-react";
import { forwardRef } from "react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/classname-utils";

interface ThemeToggleProps extends React.ComponentPropsWithoutRef<"button"> {
    variant?: "icon-only" | "menu-item";
}

/** Toggle button for switching between light and dark mode. */
export const ThemeToggle = forwardRef<HTMLButtonElement, ThemeToggleProps>(
    ({ variant = "icon-only", className, onClick, ...props }, ref) => {
        const { theme, toggleTheme } = useTheme();

        const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
            toggleTheme();
            onClick?.(e);
        };

        const icon = theme === "light" ? <Moon size={20} /> : <Sun size={20} />;

        if (variant === "menu-item") {
            return (
                <button
                    ref={ref}
                    onClick={handleClick}
                    className={cn("flex items-center gap-2 w-full", className)}
                    aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
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
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                {...props}
            >
                {icon}
            </Button>
        );
    },
);

ThemeToggle.displayName = "ThemeToggle";
