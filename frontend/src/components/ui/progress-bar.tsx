import { cn } from "@/lib/utils";

interface ProgressBarProps {
    value: number;
    max?: number;
    label?: string;
    showPercentage?: boolean;
    className?: string;
}

/** Progress bar component for achievements, construction, etc. */
export function ProgressBar({
    value,
    max = 100,
    label,
    showPercentage = true,
    className,
}: ProgressBarProps) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
        <div className={cn("space-y-2", className)}>
            {(label || showPercentage) && (
                <div className="flex justify-between items-center">
                    {label && (
                        <span className="font-semibold text-sm text-foreground">
                            {label}
                        </span>
                    )}
                    {showPercentage && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            {percentage.toFixed(0)}%
                        </span>
                    )}
                </div>
            )}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                    className="bg-brand h-full rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
