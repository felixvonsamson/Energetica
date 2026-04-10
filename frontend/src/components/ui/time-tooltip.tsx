import { Link } from "@tanstack/react-router";

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Tooltip wrapper for time displays. Shows a label and a "Learn more" link
 * to the wiki's time-and-weather page.
 */
export function TimeTooltip({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent className="max-w-48 text-center leading-snug">
                {label}.{" "}
                <Link
                    to="/app/wiki/$slug"
                    params={{ slug: "time-and-weather" }}
                    hash="game-time"
                    className="underline hover:opacity-80"
                >
                    Learn more
                </Link>
            </TooltipContent>
        </Tooltip>
    );
}
