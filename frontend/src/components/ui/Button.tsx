import { type ReactNode } from "react";

import { cn } from "@/lib/classname-utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?:
        | "primary"
        | "secondary"
        | "destructive"
        | "outline"
        | "ghost"
        | "link";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
}

/**
 * Button component with consistent styling and variants.
 *
 * @example
 *     <Button variant="primary" onClick={handleClick}>Click me</Button>
 *     <Button variant="secondary" size="sm" disabled>Disabled</Button>
 *     <Button variant="destructive" onClick={handleDelete}>Delete</Button>
 *     <Button variant="outline">Cancel</Button>
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
            "bg-primary hover:bg-primary/90 text-primary-foreground disabled:pointer-events-none disabled:opacity-50",
        secondary:
            "bg-secondary hover:bg-secondary/90 text-secondary-foreground disabled:pointer-events-none disabled:opacity-50",
        destructive:
            "bg-destructive hover:bg-destructive/90 text-destructive-foreground disabled:pointer-events-none disabled:opacity-50",
        outline:
            "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        ghost: "hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        link: "text-foreground underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50",
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
                variant !== "link" && sizeStyles[size],
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}
