/**
 * The run app's account menu: switch runs, open the lobby, and the account
 * items, behind one `CircleUser` trigger at every screen size (#1035).
 *
 * - "Switch run" lists the runs the account plays or facilitates from the lobby's
 *   Now and Coming up bands, in the lobby's order and with its badges, with no
 *   headings (`@energetica/core/run-list`, #1039). Frozen and ended runs, and
 *   runs open to join, are left out: the lobby is where you join something new
 *   or read a recap. Each run shows the action picking it takes, from
 *   {@link runEntry}. The current run stays in the list, disabled, with a tick.
 *   The item is hidden when there is no other run to switch to.
 * - On desktop "Switch run" is a side submenu. On mobile a side submenu does not
 *   fit next to the menu, so the runs expand in place below it instead.
 * - On mobile the menu also carries Notifications and the theme toggle, which are
 *   separate top-bar buttons on desktop.
 *
 * On a single-origin proxy host (e.g. energetica.ethz.ch) exactly one run is
 * reachable and the lobby is the same origin, so "Switch run" and "Open lobby"
 * would both land back on this app; they are hidden. See
 * `@energetica/core/single-origin` and ADR-0002.
 *
 * In a live-backend dev server (`BACKEND=game bun run dev`) the `/api` proxy is
 * pinned to one live instance, so links to other runs would leave the local dev
 * app for prod. Those runs are listed but disabled, and the pinned run counts
 * as the current one (see {@link devInstanceSlug}).
 */

import { Link } from "@tanstack/react-router";
import {
    Archive,
    Bell,
    CalendarDays,
    Check,
    ChevronDown,
    ChevronsUpDown,
    CircleUser,
    FlagTriangleRight,
    Home,
    LogOut,
    type LucideIcon,
    Presentation,
    Settings,
    Snowflake,
    Timer,
    Zap,
} from "lucide-react";
import { useState } from "react";

import { useMyRuns } from "@/hooks/use-my-runs";
import {
    currentRunSlug,
    devInstanceSlug,
    lobbyHref,
    runAppHref,
    runEntry,
    runFacilitatorHref,
    type RunEntry,
} from "@energetica/core/instances";
import {
    bandRuns,
    runBadge,
    type ListedRun,
    type RunBadge,
    type RunBadgeColour,
} from "@energetica/core/run-list";
import { isSingleOriginHost } from "@energetica/core/single-origin";
import { Button } from "@energetica/ui/components/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@energetica/ui/components/dropdown-menu";
import { ThemeToggle } from "@energetica/ui/components/theme-toggle";
import { useIsMobile } from "@energetica/ui/hooks/use-mobile";
import { cn } from "@energetica/ui/lib/utils";

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
 * Turns text white on a highlighted row (green background). Without it the
 * badge and the action label are unreadable there.
 */
const ON_HIGHLIGHT = "in-data-highlighted:text-accent-foreground";

/**
 * The runs the account plays or facilitates from the lobby's Now and Coming up
 * bands, in the lobby's order, plus whether any of them is somewhere other than
 * here. Frozen and ended runs are left out: the lobby is where you read a
 * recap.
 */
function useSwitchableRuns(here: string | null): {
    runs: ListedRun[];
    hasOtherRun: boolean;
} {
    const { data } = useMyRuns();
    const runs = bandRuns([
        ...(data?.runs ?? []).map((run) => ({
            ...run,
            relation: "player" as const,
        })),
        ...(data?.facilitated_runs ?? []).map((run) => ({
            ...run,
            relation: "facilitator" as const,
        })),
    ])
        .filter(({ band }) => band !== "past")
        .flatMap(({ runs: bandedRuns }) => bandedRuns);
    const hasOtherRun = runs.some((run) => run.slug !== here);
    return { runs, hasOtherRun };
}

function runHref(slug: string, entry: RunEntry): string {
    return entry.action === "manage"
        ? runFacilitatorHref(slug)
        : runAppHref(slug);
}

/** The badge under a run's name: a coloured icon and short text. */
function BadgeLabel({ badge }: { badge: RunBadge }) {
    const Icon = BADGE_ICONS[badge.status];
    return (
        <span
            className={cn(
                "flex items-center gap-1 text-xs font-semibold",
                BADGE_COLOURS[badge.colour],
                ON_HIGHLIGHT,
            )}
        >
            <Icon className="size-3 text-current" />
            {badge.text}
        </span>
    );
}

/**
 * One run: its mode icon, its name with the lobby's badge under it, then a tick
 * if it is this run, or its action.
 */
function RunItem({
    run,
    isCurrent,
    pinnedToLocalDev,
}: {
    run: ListedRun;
    isCurrent: boolean;
    pinnedToLocalDev: boolean;
}) {
    const entry = runEntry(run, run.relation);
    const badge = runBadge(run);
    const ModeIcon = run.mode === "workshop" ? Presentation : Zap;
    const body = (
        <>
            <ModeIcon />
            <span className="flex flex-col min-w-0 flex-1">
                <span className="truncate">{run.name}</span>
                {badge && <BadgeLabel badge={badge} />}
            </span>
            {isCurrent ? (
                <Check size={16} className="ml-auto" />
            ) : (
                <DropdownMenuShortcut
                    className={cn(
                        "tracking-normal whitespace-nowrap",
                        ON_HIGHLIGHT,
                    )}
                >
                    {entry.actionLabel}
                </DropdownMenuShortcut>
            )}
        </>
    );
    if (isCurrent) {
        return <DropdownMenuItem disabled>{body}</DropdownMenuItem>;
    }
    if (pinnedToLocalDev) {
        return (
            <DropdownMenuItem
                disabled
                title="Switching runs is disabled in local dev: this dev server is pinned to one live instance."
            >
                {body}
            </DropdownMenuItem>
        );
    }
    return (
        <DropdownMenuItem asChild>
            <a href={runHref(run.slug, entry)}>{body}</a>
        </DropdownMenuItem>
    );
}

function RunItems({
    runs,
    here,
    pinnedToLocalDev,
}: {
    runs: ListedRun[];
    here: string | null;
    pinnedToLocalDev: boolean;
}) {
    return runs.map((run) => (
        <RunItem
            key={run.slug}
            run={run}
            isCurrent={run.slug === here}
            pinnedToLocalDev={pinnedToLocalDev}
        />
    ));
}

function UnreadBadge({
    count,
    className,
}: {
    count: number;
    className?: string;
}) {
    if (count <= 0) return null;
    return (
        <span
            className={cn(
                "bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center",
                className,
            )}
        >
            {count}
        </span>
    );
}

export function AccountMenu({
    username,
    unreadCount,
    onShowNotifications,
}: {
    username: string;
    unreadCount: number;
    onShowNotifications: () => void;
}) {
    const isMobile = useIsMobile();
    const [runsExpanded, setRunsExpanded] = useState(false);

    // In a live-backend dev server the hostname is `localhost`, so there is no
    // run in the URL: fall back to the slug the proxy is pinned to.
    const pinnedSlug = devInstanceSlug();
    const here = currentRunSlug() ?? pinnedSlug;
    const { runs, hasOtherRun } = useSwitchableRuns(here);
    const singleOrigin = isSingleOriginHost();
    const showSwitchRun = !singleOrigin && hasOtherRun;
    const runItems = (
        <RunItems
            runs={runs}
            here={here}
            pinnedToLocalDev={pinnedSlug !== null}
        />
    );

    return (
        <DropdownMenu onOpenChange={(open) => !open && setRunsExpanded(false)}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="relative"
                    aria-label="Account menu"
                >
                    <CircleUser size={20} />
                    {isMobile && (
                        <UnreadBadge
                            count={unreadCount}
                            className="absolute -top-1 -right-1 z-20"
                        />
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className={cn(
                    "max-h-[80vh] overflow-y-auto",
                    isMobile && runsExpanded ? "w-72" : "w-56",
                )}
            >
                {isMobile && (
                    <>
                        <DropdownMenuItem onSelect={onShowNotifications}>
                            <Bell size={16} />
                            Notifications
                            <UnreadBadge
                                count={unreadCount}
                                className="ml-auto"
                            />
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <ThemeToggle variant="menu-item" />
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}

                {showSwitchRun &&
                    (isMobile ? (
                        <>
                            <DropdownMenuItem
                                aria-expanded={runsExpanded}
                                onSelect={(e) => {
                                    // Keep the menu open: this only toggles the list below.
                                    e.preventDefault();
                                    setRunsExpanded((x) => !x);
                                }}
                            >
                                <ChevronsUpDown size={16} />
                                Switch run
                                <ChevronDown
                                    size={16}
                                    className={cn(
                                        "ml-auto transition-transform",
                                        runsExpanded && "rotate-180",
                                    )}
                                />
                            </DropdownMenuItem>
                            {runsExpanded && (
                                <div className="ml-3 mb-1 border-l pl-1">
                                    {runItems}
                                </div>
                            )}
                        </>
                    ) : (
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <ChevronsUpDown size={16} />
                                Switch run
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-72 max-h-[70vh] overflow-y-auto">
                                {runItems}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    ))}
                {!singleOrigin && (
                    <>
                        <DropdownMenuItem asChild>
                            <a href={lobbyHref("/")}>
                                <Home size={16} />
                                Open lobby
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}

                <DropdownMenuLabel asChild>
                    <p>{username}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <a
                        href="https://forms.gle/GJqaK9KCNkGF8G7b7"
                        target="_blank"
                        rel="noreferrer"
                    >
                        <FlagTriangleRight size={16} />
                        Report an issue
                    </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link to="/app/settings">
                        <Settings size={16} />
                        Settings
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link to="/app/logout">
                        <LogOut size={16} />
                        Logout
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
