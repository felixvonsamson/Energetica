/**
 * The run app's account menu: switch runs, open the lobby, and the account
 * items, behind one `CircleUser` trigger at every screen size (#1035).
 *
 * - "Switch run" lists the live runs the account plays, then the ones it
 *   facilitates. Ended runs and runs open to join are left out: the lobby is
 *   where you join something new or read a recap. Each run shows the action
 *   picking it takes, from {@link runEntry}. The current run stays in the list,
 *   disabled, with a tick. The item is hidden when there is no other live run.
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
    Bell,
    Check,
    ChevronDown,
    ChevronsUpDown,
    CircleUser,
    FlagTriangleRight,
    Home,
    LogOut,
    Settings,
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
    type Phase,
    type RunEntry,
    type RunRelation,
} from "@energetica/core/instances";
import { isSingleOriginHost } from "@energetica/core/single-origin";
import { Button } from "@energetica/ui/components/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
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

/** A run as the "Switch run" list shows it. */
type SwitchableRun = {
    slug: string;
    name: string;
    entry: RunEntry;
};

type RunGroup = { label: string; runs: SwitchableRun[] };

/** Words shown before the action for phases where it is worth knowing. */
const PHASE_PREFIX: Partial<Record<Phase, string>> = {
    announced: "Upcoming",
    freeze: "Frozen",
};

/**
 * The live runs the account plays and facilitates, as labelled groups (empty
 * groups dropped), plus whether any of them is somewhere other than here.
 */
function useSwitchableRuns(here: string | null): {
    groups: RunGroup[];
    hasOtherRun: boolean;
} {
    const { data } = useMyRuns();
    const live = (
        runs: { slug: string; name: string; starts_at: string }[],
        relation: RunRelation,
    ): SwitchableRun[] =>
        runs
            .map((run) => ({
                slug: run.slug,
                name: run.name,
                entry: runEntry(run, relation),
            }))
            .filter((run) => run.entry.phase !== "ended");
    const groups = [
        { label: "Your runs", runs: live(data?.runs ?? [], "player") },
        {
            label: "Facilitating",
            runs: live(data?.facilitated_runs ?? [], "facilitator"),
        },
    ].filter((group) => group.runs.length > 0);
    const hasOtherRun = groups.some((group) =>
        group.runs.some((run) => run.slug !== here),
    );
    return { groups, hasOtherRun };
}

function runHref(run: SwitchableRun): string {
    return run.entry.action === "manage"
        ? runFacilitatorHref(run.slug)
        : runAppHref(run.slug);
}

/** One run: its name, then a tick if it is this run, or its action. */
function RunItem({
    run,
    isCurrent,
    pinnedToLocalDev,
}: {
    run: SwitchableRun;
    isCurrent: boolean;
    pinnedToLocalDev: boolean;
}) {
    if (isCurrent) {
        return (
            <DropdownMenuItem disabled>
                <span className="truncate flex-1">{run.name}</span>
                <Check size={16} className="ml-auto" />
            </DropdownMenuItem>
        );
    }
    const prefix = PHASE_PREFIX[run.entry.phase];
    const action = (
        <DropdownMenuShortcut className="tracking-normal whitespace-nowrap">
            {prefix ? `${prefix} · ` : ""}
            {run.entry.actionLabel}
        </DropdownMenuShortcut>
    );
    if (pinnedToLocalDev) {
        return (
            <DropdownMenuItem
                disabled
                title="Switching runs is disabled in local dev: this dev server is pinned to one live instance."
            >
                <span className="truncate flex-1">{run.name}</span>
                {action}
            </DropdownMenuItem>
        );
    }
    return (
        <DropdownMenuItem asChild>
            <a href={runHref(run)}>
                <span className="truncate flex-1">{run.name}</span>
                {action}
            </a>
        </DropdownMenuItem>
    );
}

function RunGroups({
    groups,
    here,
    pinnedToLocalDev,
}: {
    groups: RunGroup[];
    here: string | null;
    pinnedToLocalDev: boolean;
}) {
    return groups.map((group, i) => (
        <DropdownMenuGroup key={group.label}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-muted-foreground">
                {group.label}
            </DropdownMenuLabel>
            {group.runs.map((run) => (
                <RunItem
                    key={run.slug}
                    run={run}
                    isCurrent={run.slug === here}
                    pinnedToLocalDev={pinnedToLocalDev}
                />
            ))}
        </DropdownMenuGroup>
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
    const { groups, hasOtherRun } = useSwitchableRuns(here);
    const singleOrigin = isSingleOriginHost();
    const showSwitchRun = !singleOrigin && hasOtherRun;
    const runGroups = (
        <RunGroups
            groups={groups}
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
                                    {runGroups}
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
                                {runGroups}
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
