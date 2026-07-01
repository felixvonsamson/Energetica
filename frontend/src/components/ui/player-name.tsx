import { Circle } from "lucide-react";

import { usePlayer } from "@/hooks/use-players";
import { cn } from "@/lib/utils";
import type { Player } from "@/types/players";

type ActivityStatus = "active" | "away" | "inactive";

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
    status: ActivityStatus;
    className?: string;
}

export function ActivityDot({ status, className }: ActivityDotProps) {
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
    isSelf?: boolean;
    className?: string;
    dotClassName?: string;
}

export function PlayerName({
    player,
    isSelf,
    className,
    dotClassName,
}: PlayerNameProps) {
    return (
        <span className={cn("inline-flex items-center gap-1.5", className)}>
            <ActivityDot
                status={player.activity_status}
                className={dotClassName}
            />
            {player.username}
            {isSelf && <SelfBadge />}
        </span>
    );
}

/**
 * "You" tag shown after the current player's name. The red outline matches the
 * map tile / row-rail hue so identity reads the same across the app.
 */
function SelfBadge() {
    return (
        <span
            className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none tracking-wide"
            style={{
                color: "var(--player-self-color)",
                borderColor: "var(--player-self-color)",
            }}
        >
            You
        </span>
    );
}

interface PlayerNameByIdProps {
    playerId: number;
    isSelf?: boolean;
    className?: string;
    dotClassName?: string;
}

export function PlayerNameById({
    playerId,
    isSelf,
    className,
    dotClassName,
}: PlayerNameByIdProps) {
    const player = usePlayer(playerId);

    if (!player) return null;

    return (
        <PlayerName
            player={player}
            isSelf={isSelf}
            className={className}
            dotClassName={dotClassName}
        />
    );
}
