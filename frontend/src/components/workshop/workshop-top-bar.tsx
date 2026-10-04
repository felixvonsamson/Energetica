/**
 * The Workshop top bar (#995): the phase the session is in, and who the visitor
 * is in it. The phase countdown (#996) and the price-setting panel (#1002) will
 * sit here too.
 */

import { Link } from "@tanstack/react-router";

import Logo from "@/assets/simplified_logo.svg?react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useWorkshopEntry } from "@/hooks/use-workshop";
import { type Checkpoint, checkpointLabel } from "@/lib/workshop-timeline";

export function WorkshopTopBar({
    checkpoint,
}: {
    /** Undefined while the session is still loading. */
    checkpoint: Checkpoint | undefined;
}) {
    const { data: entry } = useWorkshopEntry();

    return (
        <header className="flex h-(--topbar-height) shrink-0 items-center gap-3 border-b border-border-brand bg-topbar px-4">
            <Link to="/app/workshop" className="flex items-center gap-1.5">
                <Logo className="size-8 fill-foreground" />
                <span className="font-titles text-lg">Energetica</span>
                <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                    Workshop
                </span>
            </Link>
            {checkpoint && (
                <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
                    {checkpointLabel(checkpoint)}
                </span>
            )}
            <div className="ml-auto flex items-center gap-3">
                {entry && (
                    <span className="text-sm text-muted-foreground">
                        {entry.player ? entry.player.username : "Facilitator"}
                    </span>
                )}
                <ThemeToggle variant="icon-only" />
                <Button variant="outline" size="sm" asChild>
                    <Link to="/app/logout">Log out</Link>
                </Button>
            </div>
        </header>
    );
}
