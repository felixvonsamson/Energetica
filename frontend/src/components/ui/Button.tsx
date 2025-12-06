import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: "primary" | "secondary";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
}

/**
 * Button component with consistent styling and variants.
 *
 * @example
 *     <Button variant="primary" onClick={handleClick}>Click me</Button>
 *     <Button variant="secondary" size="sm" disabled>Disabled</Button>
 */
export function Button({
    children,
    variant = "primary",
    size = "md",
    isLoading = false,
    disabled,
    className,
    ...props
}: ButtonProps) {
    const baseStyles = "font-medium transition-colors rounded-lg";

    const variantStyles = {
        primary:
            "bg-pine hover:bg-pine-dark dark:bg-brand-green dark:hover:bg-brand-green-dark text-white disabled:opacity-50",
        secondary:
            "bg-gray-200 hover:bg-gray-300 dark:bg-dark-bg-tertiary dark:hover:bg-dark-bg-secondary text-gray-900 dark:text-white disabled:opacity-50",
    };

    const sizeStyles = {
        sm: "px-3 py-1 text-sm",
        md: "px-4 py-2",
        lg: "px-6 py-3 text-lg",
    };

    return (
        <button
            disabled={disabled || isLoading}
            className={cn(
                baseStyles,
                variantStyles[variant],
                sizeStyles[size],
                "disabled:cursor-not-allowed",
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}
