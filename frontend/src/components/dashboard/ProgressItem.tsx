import { ChevronDown, ChevronUp, Pause, Play, X } from "lucide-react";
import { type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface ProgressItemProps {
    // Display
    title: ReactNode;
    subtitle?: string;

    // Progress
    progress: number; // 0-100
    status: "paused" | "waiting" | "ongoing" | "in-transit";
    timeRemaining?: string; // e.g., "2h 30m"
    speed?: number; // Speed multiplier (e.g., 1.2)

    // Actions
    showActions?: boolean;
    onPause?: () => void;
    onResume?: () => void;
    onCancel?: () => void;
    onIncreasePriority?: () => void;
    onDecreasePriority?: () => void;

    // Loading states for actions
    isPausing?: boolean;
    isResuming?: boolean;
    isCancelling?: boolean;
    isChangingPriority?: boolean;

    // State
    isFirstInQueue?: boolean;
    isLastInQueue?: boolean;
}

/**
 * Component for displaying a single progress item (project or shipment). Shows
 * status, progress bar, time remaining, and optional action buttons.
 *
 * @example
 *     <ProgressItem
 *         title="Coal Burner"
 *         subtitle="Level 1"
 *         progress={67}
 *         status="ongoing"
 *         timeRemaining="2h 30m"
 *         speed={1.2}
 *         showActions={true}
 *         onPause={handlePause}
 *         onCancel={handleCancel}
 *     />;
 */
export function ProgressItem({
    title,
    subtitle,
    progress,
    status,
    timeRemaining,
    speed,
    showActions = false,
    onPause,
    onResume,
    onCancel,
    onIncreasePriority,
    onDecreasePriority,
    isPausing = false,
    isResuming = false,
    isCancelling = false,
    isChangingPriority = false,
    isFirstInQueue = false,
    isLastInQueue = false,
}: ProgressItemProps) {
    const isLoading =
        isPausing || isResuming || isCancelling || isChangingPriority;

    return (
        <div className="p-3 rounded-lg bg-bone dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border">
            {/* Header row: Badge, Title, Actions */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <StatusBadge status={status} size="sm" />
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">
                            {title}
                            {subtitle && (
                                <span className="text-gray-600 dark:text-gray-400 ml-1">
                                    ({subtitle})
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                {showActions && (
                    <div className="flex items-center gap-1">
                        {/* Pause/Resume button */}
                        {status === "paused" && onResume && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onResume}
                                disabled={isLoading}
                                isLoading={isResuming}
                                className="p-1"
                                aria-label="Resume project"
                            >
                                <Play size={14} />
                            </Button>
                        )}
                        {(status === "ongoing" || status === "waiting") &&
                            onPause && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={onPause}
                                    disabled={isLoading}
                                    isLoading={isPausing}
                                    className="p-1"
                                    aria-label="Pause project"
                                >
                                    <Pause size={14} />
                                </Button>
                            )}

                        {/* Priority buttons */}
                        {onIncreasePriority && !isFirstInQueue && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onIncreasePriority}
                                disabled={isLoading}
                                isLoading={isChangingPriority}
                                className="p-1"
                                aria-label="Increase priority"
                            >
                                <ChevronUp size={14} />
                            </Button>
                        )}
                        {onDecreasePriority && !isLastInQueue && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onDecreasePriority}
                                disabled={isLoading}
                                isLoading={isChangingPriority}
                                className="p-1"
                                aria-label="Decrease priority"
                            >
                                <ChevronDown size={14} />
                            </Button>
                        )}

                        {/* Cancel button */}
                        {onCancel && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onCancel}
                                disabled={isLoading}
                                isLoading={isCancelling}
                                className="p-1 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                aria-label="Cancel project"
                            >
                                <X size={14} />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Progress bar */}
            <ProgressBar value={progress} showPercentage={false} />

            {/* Info row: Time remaining, speed */}
            <div className="flex items-center justify-between gap-2 mt-2 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-3">
                    {timeRemaining && (
                        <span>
                            {status === "paused" ? "Paused" : timeRemaining}
                        </span>
                    )}
                    {speed && speed !== 1.0 && (
                        <span className="text-gray-500 dark:text-gray-500">
                            ×{speed.toFixed(1)} speed
                        </span>
                    )}
                </div>
                <span className="font-medium">{progress.toFixed(0)}%</span>
            </div>
        </div>
    );
}
