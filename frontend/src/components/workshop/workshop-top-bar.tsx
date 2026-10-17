/**
 * The Workshop top bar (#995): the phase the session is in, and who the visitor
 * is in it, and the countdown on the running phase (#996). A player's cash sits
 * in the middle, as in the persistent world (#1249). The facilitator also gets
 * the buttons that advance the session and extend the phase, a link to their
 * console (#1011) on every other page, and a button that opens the latest Recap
 * over the page (#1013). A player gets a link to the facility page (#998) and
 * the button that opens the price-setting panel (#1002), which shows a clock
 * badge while the price-setting window is open. The account menu leads back to
 * the lobby and logs out (#1249).
 *
 * On a phone, the buttons on the right show only their icons, and the theme
 * toggle moves into the account menu, so the bar fits without scrolling.
 */

import { Link, useLocation } from "@tanstack/react-router";
import {
    ArrowLeft,
    ChevronRight,
    CircleUser,
    Clock,
    Factory,
    LogOut,
    SlidersHorizontal,
    Tags,
    TimerOff,
} from "lucide-react";

import Logo from "@/assets/simplified_logo.svg?react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Money } from "@/components/ui/money";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TypographyBrand } from "@/components/ui/typography";
import { PhaseCountdown } from "@/components/workshop/phase-countdown";
import { RecapButton } from "@/components/workshop/recap-view";
import {
    useAdvanceSession,
    useInvestmentOpen,
    usePriceSettingOpen,
    useWorkshopEntry,
    useWorkshopSelection,
} from "@/hooks/use-workshop";
import { lobbyHref } from "@/lib/instances";
import { isSingleOriginHost } from "@/lib/single-origin";
import {
    advanceAction,
    checkpointLabel,
    latestRecapRound,
} from "@/lib/workshop-timeline";
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
    const isPlayer = entry?.role === "player";
    const isFacilitator = entry?.role === "facilitator";
    const onConsole = useLocation().pathname === "/app/workshop/console";
    const recapRound = session
        ? latestRecapRound(session.checkpoint, session.round_count)
        : null;

    return (
        <header className="flex h-(--topbar-height) shrink-0 items-center gap-2 border-b border-border-brand bg-topbar px-4 md:gap-3">
            <div className="flex shrink-0 items-center gap-3">
                <HomeLink />
                {checkpoint && (
                    <span className="hidden shrink-0 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-sm font-medium text-brand lg:inline">
                        {checkpointLabel(checkpoint)}
                    </span>
                )}
                <PhaseCountdown isFacilitator={isFacilitator} />
            </div>
            <div className="flex flex-1 justify-center">
                {isPlayer && <Cash />}
            </div>
            <div className="flex shrink-0 items-center gap-2 md:gap-3">
                {isPlayer && <FacilitiesButton />}
                {isPlayer && (
                    <PricesButton
                        panelOpen={pricePanelOpen}
                        onClick={onTogglePricePanel}
                    />
                )}
                {/* Hidden on the console itself, where it would lead nowhere. */}
                {isFacilitator && !onConsole && (
                    <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        aria-label="Console"
                    >
                        <Link to="/app/workshop/console">
                            <SlidersHorizontal className="size-4" />
                            <span className="hidden md:inline">Console</span>
                        </Link>
                    </Button>
                )}
                {isFacilitator && recapRound !== null && (
                    <RecapButton round={recapRound} />
                )}
                {isFacilitator && session && (
                    <AdvanceButton session={session} />
                )}
                <ThemeToggle variant="icon-only" className="hidden md:flex" />
                {entry && (
                    <AccountMenu
                        name={
                            entry.player ? entry.player.username : "Facilitator"
                        }
                    />
                )}
            </div>
        </header>
    );
}

/** The logo, which leads to the Workshop home. */
export function HomeLink() {
    return (
        <Link to="/app/workshop" className="flex shrink-0 items-center gap-1.5">
            <Logo className="size-8 fill-foreground" />
            <span className="hidden items-baseline gap-2 xl:flex">
                <TypographyBrand className="text-2xl">
                    Energetica
                </TypographyBrand>
                <span className="font-titles text-lg">Workshop</span>
            </span>
        </Link>
    );
}

/** Leads a player to the facility page. */
export function FacilitiesButton() {
    return (
        <Button variant="ghost" size="sm" asChild aria-label="Facilities">
            <Link to="/app/workshop/facilities">
                <Factory className="size-4" />
                <span className="hidden md:inline">Facilities</span>
            </Link>
        </Button>
    );
}

/**
 * The player's cash. It is read with the selection, which is re-read whenever
 * the session or the player's loan changes, so it follows every change.
 */
function Cash() {
    const { data: selection } = useWorkshopSelection();
    if (!selection) return null;

    // On a phone, in thousands or millions, so it fits.
    return (
        <span className="text-base font-bold whitespace-nowrap md:text-xl lg:text-2xl">
            <Money amount={selection.money} className="sm:hidden" />
            <Money
                amount={selection.money}
                long
                className="hidden sm:inline-flex"
            />
        </span>
    );
}

/**
 * The account button: a person icon and the account name, which opens a menu
 * leading back to the lobby or logging out. Logging out goes through the lobby,
 * which clears the session cookie every Run shares (ADR-0002).
 */
function AccountMenu({ name }: { name: string }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Account menu">
                    <CircleUser className="size-4" />
                    <span className="hidden max-w-32 truncate sm:inline">
                        {name}
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild className="md:hidden">
                    <ThemeToggle variant="menu-item" />
                </DropdownMenuItem>
                <DropdownMenuSeparator className="md:hidden" />
                {/* On a single-origin host the lobby sends a logged-in
                    account straight back here, so there is no lobby to go to. */}
                {!isSingleOriginHost() && (
                    <DropdownMenuItem asChild>
                        <a href={lobbyHref("/")}>
                            <ArrowLeft className="size-4" />
                            Back to lobby
                        </a>
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                    <Link to="/app/logout">
                        <LogOut className="size-4" />
                        Log out
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Moves the whole room on. An advance cannot be undone, so the button says what
 * it does rather than just "Next": while a window is open it closes it (#1004),
 * and otherwise it names where the session goes. It waits while a Trading
 * period is being simulated.
 */
function AdvanceButton({ session }: { session: WorkshopSession }) {
    const { mutate: advance, isPending } = useAdvanceSession();
    const investmentOpen = useInvestmentOpen();
    const priceSettingOpen = usePriceSettingOpen();
    const action = advanceAction(session, investmentOpen || priceSettingOpen);
    if (!action) return null;

    return (
        <Button
            size="sm"
            variant={action.kind === "close_window" ? "outline" : "default"}
            disabled={isPending || action.kind === "simulating"}
            onClick={() => advance()}
            aria-label={action.label}
            title={action.label}
        >
            {/* On a phone, the icon alone, so the top bar fits. */}
            <span className="hidden md:inline">{action.label}</span>
            {action.kind === "close_window" ? (
                <TimerOff className="size-4" />
            ) : (
                <ChevronRight className="size-4" />
            )}
        </Button>
    );
}

/** Opens and closes the price-setting panel. */
export function PricesButton({
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
            aria-label="Prices"
            onClick={onClick}
            className="relative pr-5"
        >
            <Tags className="size-4" />
            <span className="hidden md:inline">Prices</span>
            {windowOpen && (
                <span
                    aria-label="Price-setting window open"
                    className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-fg-on-brand shadow-sm"
                >
                    <Clock
                        className="block size-[13px] shrink-0"
                        strokeWidth={2.75}
                    />
                </span>
            )}
        </Button>
    );
}
