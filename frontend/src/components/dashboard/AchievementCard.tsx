/**
 * Achievement progress card component. Displays a single achievement with its
 * name, progress bar, and XP reward.
 */

import { formatAchievementValue } from "@lib/format-utils";

interface AchievementCardProps {
    id: string;
    name: string;
    status: number;
    objective: number;
    reward: number;
}

/**
 * Achievement progress card. Shows visual progress towards completing an
 * achievement milestone.
 */
export function AchievementCard({
    id,
    name,
    status,
    objective,
    reward,
}: AchievementCardProps) {
    // Calculate progress percentage
    const progressPercent = Math.min(100, (status / objective) * 100);

    // Format the values based on achievement type
    const formattedStatus = formatAchievementValue(status, id);
    const formattedObjective = formatAchievementValue(objective, id);

    return (
        <div className="flex items-center gap-3">
            {/* Achievement name */}
            <div className="font-medium text-sm text-primary min-w-[140px]">
                {name}
            </div>

            {/* Progress bar */}
            <div className="flex-1 relative h-7 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                <div
                    className="absolute inset-0 bg-brand-green dark:bg-brand-green transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary z-10 px-2">
                    {formattedStatus} / {formattedObjective}
                </div>
            </div>

            {/* XP reward */}
            <div className="font-medium text-sm text-primary text-center min-w-[60px]">
                +{reward} XP
            </div>
        </div>
    );
}
