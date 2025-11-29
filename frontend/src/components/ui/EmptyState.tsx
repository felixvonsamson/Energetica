import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

/** Empty state component for when there's no data to display. */
export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center py-12 text-center",
                className,
            )}
        >
            {Icon && (
                <Icon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            )}
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {title}
            </h3>
            {description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-sm">
                    {description}
                </p>
            )}
            {action}
        </div>
    );
}
