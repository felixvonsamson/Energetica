import { type ReactNode } from "react";

import { cn } from "@/lib/cn";

interface CardProps {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
}

/** Base card component for consistent styling across the app. */
export function Card({ children, className, onClick }: CardProps) {
    return (
        <div
            className={cn(
                "bg-bone dark:bg-dark-bg-secondary p-6 rounded-lg",
                "text-bone-text dark:text-dark-text-primary",
                className,
            )}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

interface CardHeaderProps {
    children: ReactNode;
    className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
    return <div className={cn("mb-4", className)}>{children}</div>;
}

interface CardTitleProps {
    children: ReactNode;
    className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
    return (
        <h2
            className={cn(
                "text-2xl font-bold",
                "text-bone-text dark:text-dark-text-primary",
                className,
            )}
        >
            {children}
        </h2>
    );
}

interface CardContentProps {
    children: ReactNode;
    className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
    return <div className={cn("space-y-2", className)}>{children}</div>;
}
