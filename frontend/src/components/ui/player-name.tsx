import { Circle } from "lucide-react";

import { usePlayer } from "@/hooks/use-players";
import { cn } from "@/lib/utils";
import type { Player } from "@/types/players";

type ActivityStatus = "active" | "away" | "inactive";

const ACTIVE_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12 hours
const AWAY_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function getActivityStatus(lastConnection: string | null): ActivityStatus {
    if (!lastConnection) return "inactive";
    const elapsed = Date.now() - new Date(lastConnection).getTime();
    if (elapsed < ACTIVE_THRESHOLD_MS) return "active";
    if (elapsed < AWAY_THRESHOLD_MS) return "away";
    return "inactive";
}

const statusStyles: Record<ActivityStatus, string> = {
    active: "text-green-500",
    away: "text-orange-500",
    inactive: "text-muted-foreground/40",
};

const statusLabels: Record<ActivityStatus, string> = {
    active: "Active",
    away: "Away",
    inactive: "Inactive",
};

interface ActivityDotProps {
    lastConnection: string | null;
    className?: string;
}

export function ActivityDot({ lastConnection, className }: ActivityDotProps) {
    const status = getActivityStatus(lastConnection);
    return (
        <Circle
            className={cn("size-2 shrink-0", statusStyles[status], className)}
            fill="currentColor"
            strokeWidth={0}
            aria-label={statusLabels[status]}
        />
    );
}

interface PlayerNameProps {
    player: Player;
    className?: string;
    dotClassName?: string;
}

export function PlayerName({ player, className, dotClassName }: PlayerNameProps) {
    return (
        <span className={cn("inline-flex items-center gap-1.5", className)}>
            <ActivityDot lastConnection={player.last_connection ?? null} className={dotClassName} />
            {player.username}
        </span>
    );
}

interface PlayerNameByIdProps {
    playerId: number;
    className?: string;
    dotClassName?: string;
}

export function PlayerNameById({ playerId, className, dotClassName }: PlayerNameByIdProps) {
    const player = usePlayer(playerId);

    if (!player) return null;

    return <PlayerName player={player} className={className} dotClassName={dotClassName} />;
}
