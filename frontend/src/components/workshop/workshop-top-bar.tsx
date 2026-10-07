/**
 * The Workshop top bar (#995): the phase the session is in, and who the visitor
 * is in it, and the countdown on the running phase (#996). The facilitator also
 * gets the buttons that advance the session and extend the phase. A player gets
 * a link to the facility page (#998) and the button that opens the
 * price-setting panel (#1002), which shows a clock badge while the
 * price-setting window is open.
 */

import { Link } from "@tanstack/react-router";
import { ChevronRight, Clock, Factory, Tags } from "lucide-react";

import Logo from "@/assets/simplified_logo.svg?react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PhaseCountdown } from "@/components/workshop/phase-countdown";
import {
    useAdvanceSession,
    usePriceSettingOpen,
    useWorkshopEntry,
} from "@/hooks/use-workshop";
import { checkpointLabel } from "@/lib/workshop-timeline";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopSession = ApiSchema<"WorkshopSessionOut">;

export function WorkshopTopBar({
    session,
    pricePanelOpen,
    onTogglePricePanel,
}: {
    /** Undefined while the session is still loading. */
    session: WorkshopSession | undefined;
    pricePanelOpen: boolean;
    onTogglePricePanel: () => void;
}) {
    const { data: entry } = useWorkshopEntry();
    const checkpoint = session?.checkpoint;
    const isFacilitator = entry?.role === "facilitator";

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
            <PhaseCountdown isFacilitator={isFacilitator} />
            <div className="ml-auto flex items-center gap-3">
                {entry?.role === "player" && (
                    <Button variant="ghost" size="sm" asChild>
                        <Link to="/app/workshop/facilities">
                            <Factory className="size-4" />
                            Facilities
                        </Link>
                    </Button>
                )}
                {entry?.role === "player" && (
                    <PricesButton
                        panelOpen={pricePanelOpen}
                        onClick={onTogglePricePanel}
                    />
                )}
                {isFacilitator && session && (
                    <AdvanceButton session={session} />
                )}
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

/**
 * Moves the whole room to the next checkpoint. An advance cannot be undone, so
 * the button names where it goes rather than just saying "Next".
 */
function AdvanceButton({ session }: { session: WorkshopSession }) {
    const { mutate: advance, isPending } = useAdvanceSession();
    const next = session.next_checkpoint;
    if (!next) return null;

    return (
        <Button size="sm" disabled={isPending} onClick={() => advance()}>
            {session.checkpoint.kind === "not_started"
                ? "Start the session"
                : `Next: ${checkpointLabel(next)}`}
            <ChevronRight className="size-4" />
        </Button>
    );
}

/** Opens and closes the price-setting panel. */
function PricesButton({
    panelOpen,
    onClick,
}: {
    panelOpen: boolean;
    onClick: () => void;
}) {
    const windowOpen = usePriceSettingOpen();

    return (
        <Button
            variant={panelOpen ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={panelOpen}
            onClick={onClick}
            className="relative pr-5"
        >
            <Tags className="size-4" />
            Prices
            {windowOpen && (
                <span
                    aria-label="Price-setting window open"
                    className="absolute -top-1 -right-2.5 flex size-6 items-center justify-center rounded-full bg-brand text-fg-on-brand shadow-sm"
                >
                    <Clock
                        className="block size-[15px] shrink-0"
                        strokeWidth={2.75}
                    />
                </span>
            )}
        </Button>
    );
}
