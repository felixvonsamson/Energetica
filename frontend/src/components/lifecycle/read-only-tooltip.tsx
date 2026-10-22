/**
 * Explains a game-action control that is disabled because the game has frozen
 * (#866). Controls stay in place, greyed out, rather than disappearing, so the
 * page still reads as the game the player played.
 *
 * The caller disables the control itself (`disabled={... || readOnly}`, with
 * `useIsReadOnly`). This only adds the tooltip. A disabled button fires no
 * pointer events, so the tooltip hangs on a wrapping `<span>`.
 */

import type { ReactNode } from "react";

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@energetica/ui/components/tooltip";

export const READ_ONLY_REASON = "Unavailable — the game has ended";

export function ReadOnlyTooltip({
    readOnly,
    className = "inline-flex",
    children,
}: {
    readOnly: boolean;
    /**
     * Classes for the wrapping `<span>`, e.g. `block` around a full-width
     * group.
     */
    className?: string;
    children: ReactNode;
}) {
    if (!readOnly) return children;
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className={className}>{children}</span>
            </TooltipTrigger>
            <TooltipContent>{READ_ONLY_REASON}</TooltipContent>
        </Tooltip>
    );
}
