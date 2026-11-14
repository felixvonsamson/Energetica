/**
 * A run's badge, drawn as a coloured icon and short text with no pill. The
 * lobby's run list and the run app's "Switch run" menu both use it, so a run
 * carries the same badge in both. The badge itself (its status, text and
 * colour) comes from `runBadge` in `@energetica/core/run-list`; this component
 * only picks the icon and the colour class.
 */

import type { RunBadge, RunBadgeColour } from "@energetica/core/run-list";
import {
    Archive,
    CalendarDays,
    type LucideIcon,
    Snowflake,
    Timer,
} from "lucide-react";

import { cn } from "#ui/lib/utils";

const BADGE_ICONS: Record<RunBadge["status"], LucideIcon> = {
    "starting-soon": Timer,
    upcoming: CalendarDays,
    frozen: Snowflake,
    ended: Archive,
};

const BADGE_COLOURS: Record<RunBadgeColour, string> = {
    warning: "text-warning",
    info: "text-info",
    frozen: "text-frozen",
    "muted-foreground": "text-muted-foreground",
};

/**
 * The icon is sized to the text (`1em`), so set the size with a text class on
 * the badge or its parent. `className` can also override the colour, for
 * example on a highlighted menu row.
 */
export function RunBadgeLabel({
    badge,
    className,
}: {
    badge: RunBadge;
    className?: string;
}) {
    const Icon = BADGE_ICONS[badge.status];
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 align-middle font-semibold",
                BADGE_COLOURS[badge.colour],
                className,
            )}
        >
            {/* `text-current` stops a parent's svg colour rule (the dropdown
                menu has one) from overriding the badge colour. */}
            <Icon className="size-[1em] shrink-0 text-current" />
            {badge.text}
        </span>
    );
}
