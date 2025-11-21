import { ProgressBar } from "@/components/ui";

interface AchievementCardProps {
    name: string;
    progress: number;
    max?: number;
}

/**
 * Achievement progress card.
 */
export function AchievementCard({
    name,
    progress,
    max = 100,
}: AchievementCardProps) {
    return (
        <div className="bg-bone dark:bg-dark-bg-tertiary text-bone-text dark:text-dark-text-primary p-4 rounded">
            <ProgressBar
                value={progress}
                max={max}
                label={name}
                showPercentage={true}
            />
        </div>
    );
}
