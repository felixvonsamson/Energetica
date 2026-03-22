/**
 * Achievement progress card component. Displays a single achievement with its
 * name, progress bar, and XP reward.
 */

import {
    ACHIEVEMENT_MILESTONE_CONFIG,
    ACHIEVEMENT_UNLOCK_CONFIG,
} from "@/lib/achievement-config";
import type { components } from "@/types/api.generated";

type AchievementCardProps =
    | components["schemas"]["AchievementMilestoneOut"]
    | components["schemas"]["AchievementUnlockOut"];

/**
 * Achievement progress card. Shows visual progress towards completing an
 * achievement milestone.
 */
export function AchievementCard(achievement: AchievementCardProps) {
    const { id, status, objective, reward } = achievement;

    const progressPercent = Math.min(100, (status / objective) * 100);

    let name: string;
    let format: (v: number) => string;

    if (achievement.type === "milestone") {
        const config =
            ACHIEVEMENT_MILESTONE_CONFIG[
                id as keyof typeof ACHIEVEMENT_MILESTONE_CONFIG
            ];
        name = `${config.name} ${achievement.level}`;
        format = config.format;
    } else {
        const config =
            ACHIEVEMENT_UNLOCK_CONFIG[
                id as keyof typeof ACHIEVEMENT_UNLOCK_CONFIG
            ];
        name = config.name;
        format = (v: number) => v.toString();
    }

    return (
        <div className="flex items-center gap-3">
            {/* Achievement name */}
            <div className="font-medium text-sm text-foreground min-w-35">
                {name}
            </div>

            {/* Progress bar */}
            <div className="flex-1 relative h-7 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                <div
                    className="absolute inset-0 bg-brand-green dark:bg-brand-green transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-foreground z-10 px-2">
                    {format(status)} / {format(objective)}
                </div>
            </div>

            {/* XP reward */}
            <div className="font-medium text-sm text-foreground text-center min-w-15">
                +{reward} XP
            </div>
        </div>
    );
}
