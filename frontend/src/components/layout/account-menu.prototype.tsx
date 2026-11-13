/**
 * PROTOTYPE — throwaway, for "Merge the run switcher into the account dropdown"
 * (#1035, on the map #1373).
 *
 * Four variants of one account menu that also switches runs, mounted in the
 * real top bar of the run app, switchable with `?variant=A|B|C|D`. Fixture runs
 * with `?runs=many|few|none` (default `many`), since a local dev server has
 * almost no runs. Items do not navigate.
 *
 * Every variant uses ONE trigger at every screen size. On mobile the same menu
 * also carries Notifications and the theme toggle (today's three-dot menu), so
 * the mobile layout can be judged per variant by narrowing the window.
 */

import {
    Bell,
    Check,
    ChevronDown,
    ChevronsUpDown,
    CircleUser,
    FlagTriangleRight,
    Home,
    LogOut,
    Presentation,
    Search,
    Settings,
    Shield,
    Trophy,
    Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
    PrototypeSwitcher,
    usePrototypeParam,
} from "@/components/layout/prototype-switcher";
import {
    currentRunSlug,
    devInstanceSlug,
    runEntry,
    type Phase,
    type RunEntry,
    type RunRelation,
} from "@energetica/core/instances";
import { Button } from "@energetica/ui/components/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@energetica/ui/components/command";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@energetica/ui/components/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@energetica/ui/components/dropdown-menu";
import { ThemeToggle } from "@energetica/ui/components/theme-toggle";
import { cn } from "@energetica/ui/lib/utils";

/** Matches the top bar's `md` breakpoint, where the desktop buttons appear. */
function useIsMobile() {
    const query = "(max-width: 767px)";
    const [mobile, setMobile] = useState(
        () => window.matchMedia(query).matches,
    );
    useEffect(() => {
        const mq = window.matchMedia(query);
        const on = () => setMobile(mq.matches);
        mq.addEventListener("change", on);
        return () => mq.removeEventListener("change", on);
    }, []);
    return mobile;
}

// ---------------------------------------------------------------- fixtures

type ProtoRun = {
    slug: string;
    name: string;
    mode: "freeplay" | "workshop";
    relation: RunRelation;
    entry: RunEntry;
};

const DAY = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();

type Fixture = {
    slug: string;
    name: string;
    mode: "freeplay" | "workshop";
    relation: RunRelation;
    starts: number;
    freeze?: number;
    ended?: number;
};

const MANY: Fixture[] = [
    { slug: "volta", name: "Volta", mode: "freeplay", relation: "player", starts: -60 },
    { slug: "ampere", name: "Ampère", mode: "freeplay", relation: "player", starts: -20, freeze: 30 },
    { slug: "eth-hs26-group-b", name: "ETH HS26 · Group B", mode: "workshop", relation: "player", starts: -1, freeze: -0.1, ended: 3 },
    { slug: "eth-hs26-group-a", name: "ETH HS26 · Group A", mode: "workshop", relation: "facilitator", starts: -1, freeze: 1 },
    { slug: "epfl-spring", name: "EPFL energy workshop (spring)", mode: "workshop", relation: "facilitator", starts: 12, freeze: 13 },
    { slug: "kelvin", name: "Kelvin", mode: "freeplay", relation: "visitor", starts: 5 },
    { slug: "joule", name: "Joule", mode: "freeplay", relation: "visitor", starts: -3 },
    { slug: "hertz", name: "Hertz", mode: "freeplay", relation: "player", starts: -200, freeze: -40, ended: -30 },
    { slug: "ohm", name: "Ohm", mode: "freeplay", relation: "player", starts: -400, freeze: -220, ended: -210 },
    { slug: "tesla", name: "Tesla", mode: "freeplay", relation: "player", starts: -600, freeze: -420, ended: -410 },
    { slug: "eth-fs26", name: "ETH FS26 workshop", mode: "workshop", relation: "player", starts: -250, freeze: -249, ended: -245 },
    { slug: "unige-2026", name: "UNIGE climate day 2026", mode: "workshop", relation: "facilitator", starts: -100, freeze: -99, ended: -95 },
];

const FEW: Fixture[] = [MANY[0]!, MANY[7]!];

function useFixtureRuns(): ProtoRun[] {
    const which = usePrototypeParam("runs", "many");
    const source = which === "none" ? [] : which === "few" ? FEW : MANY;
    return source.map((f) => ({
        slug: f.slug,
        name: f.name,
        mode: f.mode,
        relation: f.relation,
        entry: runEntry(
            {
                starts_at: at(f.starts),
                freeze_at: f.freeze === undefined ? null : at(f.freeze),
                ended_at: f.ended === undefined ? null : at(f.ended),
            },
            f.relation,
        ),
    }));
}

function useHere(): string {
    return currentRunSlug() ?? devInstanceSlug() ?? "volta";
}

type Groups = {
    playing: ProtoRun[];
    facilitating: ProtoRun[];
    open: ProtoRun[];
    ended: ProtoRun[];
};

function group(runs: ProtoRun[]): Groups {
    const live = runs.filter((r) => r.entry.phase !== "ended");
    return {
        playing: live.filter((r) => r.relation === "player"),
        facilitating: live.filter((r) => r.relation === "facilitator"),
        open: live.filter((r) => r.relation === "visitor"),
        ended: runs.filter((r) => r.entry.phase === "ended"),
    };
}

// ---------------------------------------------------------------- shared bits

const PHASE_HINT: Record<Phase, string | null> = {
    announced: "Upcoming",
    active: null,
    freeze: "Frozen",
    ended: "Ended",
};

function RunIcon({ run, size = 16 }: { run: ProtoRun; size?: number }) {
    if (run.entry.phase === "ended") return <Trophy size={size} />;
    if (run.relation === "facilitator") return <Shield size={size} />;
    if (run.mode === "workshop") return <Presentation size={size} />;
    return <Zap size={size} />;
}

/** One run as a dropdown row: icon, name, then "current" or the action. */
function RunItem({ run, here }: { run: ProtoRun; here: string }) {
    const isCurrent = run.slug === here;
    const hint = PHASE_HINT[run.entry.phase];
    return (
        <DropdownMenuItem
            disabled={isCurrent}
            onSelect={(e) => e.preventDefault()}
            className="group flex items-center gap-2"
        >
            <RunIcon run={run} />
            <span className="truncate flex-1">{run.name}</span>
            {isCurrent ? (
                <Check size={16} />
            ) : (
                <span className="text-xs text-muted-foreground group-focus:text-accent-foreground/80 whitespace-nowrap">
                    {hint && run.entry.phase !== "ended" ? `${hint} · ` : ""}
                    {run.entry.actionLabel}
                </span>
            )}
        </DropdownMenuItem>
    );
}

function RunSections({
    groups,
    here,
    include = ["playing", "facilitating", "open", "ended"],
}: {
    groups: Groups;
    here: string;
    include?: (keyof Groups)[];
}) {
    const labels: Record<keyof Groups, string> = {
        playing: "Your runs",
        facilitating: "Facilitating",
        open: "Open to join",
        ended: "Ended",
    };
    const shown = include.filter((k) => groups[k].length > 0);
    return (
        <>
            {shown.map((k, i) => (
                <DropdownMenuGroup key={k}>
                    {i > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {labels[k]}
                    </DropdownMenuLabel>
                    {groups[k].map((r) => (
                        <RunItem key={r.slug} run={r} here={here} />
                    ))}
                </DropdownMenuGroup>
            ))}
        </>
    );
}

function OpenLobbyItem() {
    return (
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <Home size={16} />
            Open lobby
        </DropdownMenuItem>
    );
}

/** Notifications + theme, shown inside the menu on mobile only. */
function MobileExtras({
    unreadCount,
    onNotifications,
}: {
    unreadCount: number;
    onNotifications: () => void;
}) {
    return (
        <>
            <DropdownMenuItem onSelect={onNotifications}>
                <Bell size={16} />
                Notifications
                {unreadCount > 0 && (
                    <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
                <ThemeToggle variant="menu-item" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
        </>
    );
}

function AccountItems({ username }: { username: string }) {
    return (
        <>
            <DropdownMenuLabel asChild>
                <p>{username}</p>
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <FlagTriangleRight size={16} />
                Report an issue
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Settings size={16} />
                Settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <LogOut size={16} />
                Logout
            </DropdownMenuItem>
        </>
    );
}

function UserTrigger({ unreadCount }: { unreadCount: number }) {
    const isMobile = useIsMobile();
    return (
        <DropdownMenuTrigger asChild>
            <Button
                variant="outline"
                size="icon"
                className="relative"
                aria-label="Account menu"
            >
                <CircleUser size={20} />
                {isMobile && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center z-20">
                        {unreadCount}
                    </span>
                )}
            </Button>
        </DropdownMenuTrigger>
    );
}

type VariantProps = {
    username: string;
    unreadCount: number;
    onNotifications: () => void;
};

// ---------------------------------------------------------------- variants

/** A — "Switch run ›" submenu holding every run, grouped. */
function VariantA({ username, unreadCount, onNotifications }: VariantProps) {
    const runs = useFixtureRuns();
    const here = useHere();
    const isMobile = useIsMobile();
    // Revised after review: only runs you can enter or manage right now. Joining
    // something new and reading recaps of ended runs happen in the lobby.
    const groups = group(runs);
    const elsewhere = [...groups.playing, ...groups.facilitating].filter(
        (r) => r.slug !== here,
    );
    // Mobile: a side submenu does not fit next to the menu (it spilled off the
    // left edge on a phone), so "Switch run" expands the runs in place instead.
    const [expanded, setExpanded] = useState(false);
    return (
        <DropdownMenu onOpenChange={(open) => !open && setExpanded(false)}>
            <UserTrigger unreadCount={unreadCount} />
            <DropdownMenuContent
                align="end"
                className={cn(
                    "max-h-[80vh] overflow-y-auto",
                    isMobile && expanded ? "w-72" : "w-56",
                )}
            >
                {isMobile && (
                    <MobileExtras
                        unreadCount={unreadCount}
                        onNotifications={onNotifications}
                    />
                )}
                {elsewhere.length > 0 && isMobile && (
                    <>
                        <DropdownMenuItem
                            className="gap-2"
                            onSelect={(e) => {
                                e.preventDefault();
                                setExpanded((x) => !x);
                            }}
                        >
                            <ChevronsUpDown size={16} />
                            Switch run
                            <ChevronDown
                                size={16}
                                className={cn(
                                    "ml-auto transition-transform",
                                    expanded && "rotate-180",
                                )}
                            />
                        </DropdownMenuItem>
                        {expanded && (
                            <div className="ml-3 border-l pl-1 mb-1">
                                <RunSections
                                    groups={groups}
                                    here={here}
                                    include={["playing", "facilitating"]}
                                />
                            </div>
                        )}
                    </>
                )}
                {elsewhere.length > 0 && !isMobile && (
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="gap-2">
                            <ChevronsUpDown size={16} />
                            Switch run
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-72 max-h-[70vh] overflow-y-auto">
                            <RunSections
                                groups={groups}
                                here={here}
                                include={["playing", "facilitating"]}
                            />
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                )}
                <OpenLobbyItem />
                <DropdownMenuSeparator />
                <AccountItems username={username} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** B — live runs inline in the menu; ended runs behind one "Past runs" submenu. */
function VariantB({ username, unreadCount, onNotifications }: VariantProps) {
    const runs = useFixtureRuns();
    const here = useHere();
    const isMobile = useIsMobile();
    const groups = group(runs);
    return (
        <DropdownMenu>
            <UserTrigger unreadCount={unreadCount} />
            <DropdownMenuContent
                align="end"
                className="w-72 max-h-[85vh] overflow-y-auto"
            >
                {isMobile && (
                    <MobileExtras
                        unreadCount={unreadCount}
                        onNotifications={onNotifications}
                    />
                )}
                <RunSections
                    groups={groups}
                    here={here}
                    include={["playing", "facilitating", "open"]}
                />
                {groups.ended.length > 0 && (
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="gap-2">
                            <Trophy size={16} />
                            Past runs
                            <span className="ml-auto text-xs text-muted-foreground">
                                {groups.ended.length}
                            </span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-64">
                            {groups.ended.map((r) => (
                                <RunItem key={r.slug} run={r} here={here} />
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                )}
                <OpenLobbyItem />
                <DropdownMenuSeparator />
                <AccountItems username={username} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * C — the trigger names the current run ("Volta ▾" + avatar), like a workspace
 * switcher. Wide menu: current run on top, other runs, then the account.
 */
function VariantC({ username, unreadCount, onNotifications }: VariantProps) {
    const runs = useFixtureRuns();
    const here = useHere();
    const isMobile = useIsMobile();
    const current = runs.find((r) => r.slug === here);
    const others = runs.filter((r) => r.slug !== here);
    const groups = group(others);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className="relative gap-2 max-w-48 px-2"
                    aria-label="Run and account menu"
                >
                    {current && <RunIcon run={current} />}
                    <span className="truncate hidden sm:inline">
                        {current?.name ?? "Energetica"}
                    </span>
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase">
                        {username.slice(0, 1)}
                    </span>
                    {isMobile && unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center z-20">
                            {unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-80 max-h-[85vh] overflow-y-auto"
            >
                {current && (
                    <>
                        <div className="flex items-center gap-3 px-2 py-2">
                            <div className="bg-primary/10 text-primary rounded-xl p-2">
                                <RunIcon run={current} size={20} />
                            </div>
                            <div className="min-w-0">
                                <p className="font-semibold truncate">
                                    {current.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    You are here ·{" "}
                                    {current.mode === "workshop"
                                        ? "Workshop"
                                        : "Freeplay"}
                                </p>
                            </div>
                        </div>
                        <DropdownMenuSeparator />
                    </>
                )}
                {isMobile && (
                    <MobileExtras
                        unreadCount={unreadCount}
                        onNotifications={onNotifications}
                    />
                )}
                <RunSections groups={groups} here={here} />
                <DropdownMenuSeparator />
                <OpenLobbyItem />
                <DropdownMenuSeparator />
                <AccountItems username={username} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** D — the menu has one "Switch run…" item that opens a searchable dialog. */
function VariantD({ username, unreadCount, onNotifications }: VariantProps) {
    const runs = useFixtureRuns();
    const here = useHere();
    const isMobile = useIsMobile();
    const [open, setOpen] = useState(false);
    const groups = group(runs);
    const labels: [keyof Groups, string][] = [
        ["playing", "Your runs"],
        ["facilitating", "Facilitating"],
        ["open", "Open to join"],
        ["ended", "Ended"],
    ];
    return (
        <>
            <DropdownMenu>
                <UserTrigger unreadCount={unreadCount} />
                <DropdownMenuContent align="end" className="w-56">
                    {isMobile && (
                        <MobileExtras
                            unreadCount={unreadCount}
                            onNotifications={onNotifications}
                        />
                    )}
                    <DropdownMenuItem onSelect={() => setOpen(true)}>
                        <Search size={16} />
                        Switch run…
                        <span className="ml-auto text-xs text-muted-foreground">
                            {runs.length}
                        </span>
                    </DropdownMenuItem>
                    <OpenLobbyItem />
                    <DropdownMenuSeparator />
                    <AccountItems username={username} />
                </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-4 pt-4 pb-2">
                        <DialogTitle>Switch run</DialogTitle>
                    </DialogHeader>
                    <Command>
                        <CommandInput placeholder="Find a run…" />
                        <CommandList className="max-h-[60vh]">
                            <CommandEmpty>No run found.</CommandEmpty>
                            {labels.map(([k, label]) =>
                                groups[k].length === 0 ? null : (
                                    <CommandGroup key={k} heading={label}>
                                        {groups[k].map((r) => (
                                            <CommandItem
                                                key={r.slug}
                                                value={r.name}
                                                disabled={r.slug === here}
                                                className={cn(
                                                    "flex items-center gap-2",
                                                )}
                                            >
                                                <RunIcon run={r} />
                                                <span className="truncate flex-1">
                                                    {r.name}
                                                </span>
                                                {r.slug === here ? (
                                                    <Check size={16} />
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">
                                                        {r.entry.actionLabel}
                                                    </span>
                                                )}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                ),
                            )}
                            <CommandGroup heading="Lobby">
                                <CommandItem value="open lobby">
                                    <Home size={16} />
                                    Open lobby
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ---------------------------------------------------------------- switcher

const VARIANTS = [
    { key: "A", name: "Switch-run submenu" },
    { key: "B", name: "Live runs inline, past runs in a submenu" },
    { key: "C", name: "Trigger names the current run" },
    { key: "D", name: "Searchable switch-run dialog" },
];

export function AccountMenuPrototype(props: VariantProps) {
    const variant = usePrototypeParam("variant", "A");
    const runs = usePrototypeParam("runs", "many");
    return (
        <>
            {variant === "A" && <VariantA {...props} />}
            {variant === "B" && <VariantB {...props} />}
            {variant === "C" && <VariantC {...props} />}
            {variant === "D" && <VariantD {...props} />}
            <PrototypeSwitcher
                variants={VARIANTS}
                current={variant}
                extra={
                    <span className="text-xs opacity-70 pr-2">
                        runs={runs}
                    </span>
                }
            />
        </>
    );
}
