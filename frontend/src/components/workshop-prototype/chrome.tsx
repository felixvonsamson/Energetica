/**
 * PROTOTYPE — Workshop Mode global chrome (issue #992).
 *
 * Mockup of the persistent chrome §12 of the Workshop Mode spec describes: a
 * round/trading-period timeline, a phase countdown, and a collapsible
 * price-setting side panel that resizes the layout instead of overlaying it.
 * Everything here reads sample data and holds only local UI state — nothing is
 * wired to the backend. See `frontend/src/routes/app/prototype/workshop/` for
 * how the mockup pages use it.
 */

import { Link } from "@tanstack/react-router";
import {
    Check,
    ChevronRight,
    FlaskConical,
    Lock,
    Sparkles,
    Tags,
    X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import Logo from "@/assets/simplified_logo.svg?react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Separator } from "@/components/ui/separator";
import { TypographyBrand } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { CATEGORY_META, SEASON_META } from "@/lib/workshop-prototype/meta";
import {
    CATALOG,
    FLEET,
    ROUND_SEASON_STATUS,
    SEASONS,
    SESSION,
    type Season,
} from "@/lib/workshop-prototype/sample-data";

// ---------------------------------------------------------------------------
// Prototype ribbon — clearly marks the mockup as throwaway.
// ---------------------------------------------------------------------------

export function PrototypeRibbon() {
    return (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-border-brand bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-lg">
            <FlaskConical className="size-3.5 text-brand" />
            <span>
                Prototype — Workshop Mode UI mockup, issue{" "}
                <a
                    href="https://github.com/felixvonsamson/Energetica/issues/992"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-foreground"
                >
                    #992
                </a>
                . Fake data throughout.
            </span>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Phase countdown
// ---------------------------------------------------------------------------

export type PhaseKind = "investment" | "price-setting" | "review" | "recap";

const PHASE_STYLES: Record<PhaseKind, string> = {
    investment: "bg-info/15 text-info border-info/30",
    "price-setting": "bg-warning/15 text-warning border-warning/30",
    review: "bg-muted text-muted-foreground border-border",
    recap: "bg-brand/15 text-brand border-brand/30",
};

/**
 * A live mm:ss countdown, ticking down from `initialSeconds`. Wall-clock, not
 * game-tick — Workshop's phase timer is real time (spec §9).
 */
export function PhaseCountdown({
    label,
    kind,
    initialSeconds,
}: {
    label: string;
    kind: PhaseKind;
    initialSeconds: number | null;
}) {
    // `initialSeconds` is fixed per page in this mockup, so the interval only
    // needs to be (re)armed when it changes — no separate reset-on-prop-change
    // effect is needed (each page mounts its own countdown once).
    const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

    useEffect(() => {
        if (initialSeconds === null) return;
        const id = setInterval(() => {
            setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1)));
        }, 1000);
        return () => clearInterval(id);
    }, [initialSeconds]);

    const mm = secondsLeft !== null ? Math.floor(secondsLeft / 60) : null;
    const ss = secondsLeft !== null ? secondsLeft % 60 : null;

    return (
        <div
            className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium shrink-0",
                PHASE_STYLES[kind],
            )}
        >
            <span>{label}</span>
            {secondsLeft !== null && (
                <span className="font-mono tabular-nums">
                    {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                </span>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Round / trading-period timeline
// ---------------------------------------------------------------------------

interface TimelineProps {
    /** Round shown as "current" in the strip. */
    currentRound?: number;
    /** Season highlighted, if any (only meaningful within currentRound). */
    currentSeason?: Season;
    /** Recap node highlighted, if any — the recap that closes this round. */
    currentRecapForRound?: number;
}

/**
 * The nav only ever shows two consecutive rounds — Felix's feedback on the
 * first pass was that all `SESSION.totalRounds` at once was clutter for a
 * moderator-paced session nobody scrubs through freely. This picks the round
 * _before_ `currentRound` plus `currentRound` itself (so there's always a "how
 * did we get here" round to glance back at), sliding the window forward near
 * the end so it never runs past the last round.
 */
function windowAround(
    currentRound: number,
    totalRounds: number,
): [number, number] {
    const second = Math.min(Math.max(currentRound, 1), totalRounds);
    const first = second > 1 ? second - 1 : second;
    return first === second
        ? [first, Math.min(first + 1, totalRounds)]
        : [first, second];
}

export function WorkshopTimeline({
    currentRound = SESSION.currentRound,
    currentSeason,
    currentRecapForRound,
}: TimelineProps) {
    const [first, second] = windowAround(currentRound, SESSION.totalRounds);
    // The nav only ever renders two rounds, so a recap that closes the very
    // last round would otherwise never get a node at all — that's the "last
    // round needs a recap too" gap. Shown whenever the window reaches the
    // final round; its own status (not `currentRound`, which has no "round
    // totalRounds+1" to compare against) decides whether it's clickable yet.
    const showFinalRecap = second === SESSION.totalRounds;
    const finalRoundDone = Object.values(
        ROUND_SEASON_STATUS[SESSION.totalRounds] ?? {},
    ).every((status) => status === "done");

    return (
        <div className="flex items-center justify-center gap-8 overflow-x-auto px-4 py-3 border-b border-border-brand bg-surface-card">
            <RoundBlock
                round={first}
                currentRound={currentRound}
                currentSeason={currentSeason}
            />
            <RecapNode
                round={first}
                isCurrent={currentRecapForRound === first}
                isClickable={first < currentRound}
            />
            <RoundBlock
                round={second}
                currentRound={currentRound}
                currentSeason={currentSeason}
            />
            {showFinalRecap && (
                <RecapNode
                    round={second}
                    isCurrent={currentRecapForRound === second}
                    isClickable={finalRoundDone}
                    isFinal
                />
            )}
        </div>
    );
}

function RoundBlock({
    round,
    currentRound,
    currentSeason,
}: {
    round: number;
    currentRound: number;
    currentSeason: Season | undefined;
}) {
    const seasonStatus = ROUND_SEASON_STATUS[round] ?? ROUND_SEASON_STATUS[1]!;
    const roundState: "done" | "current" | "upcoming" =
        round < currentRound
            ? "done"
            : round === currentRound
              ? "current"
              : "upcoming";

    return (
        <div
            className={cn(
                "flex flex-col items-center gap-2 rounded-xl px-5 py-2.5",
                roundState === "current" &&
                    "bg-brand/10 border border-brand/40",
                roundState === "upcoming" && "opacity-40",
            )}
        >
            <Link
                to="/app/prototype/workshop/round"
                search={{ round }}
                className={cn(
                    "text-sm font-semibold tracking-wide",
                    roundState === "upcoming" && "pointer-events-none",
                    roundState !== "upcoming" && "hover:underline",
                )}
            >
                Round {round}
            </Link>
            <div className="flex items-center gap-3">
                {SEASONS.map((season) => {
                    const status = seasonStatus[season];
                    const Icon = SEASON_META[season].icon;
                    const isCurrent =
                        round === currentRound && season === currentSeason;
                    const clickable = status !== "upcoming";
                    return (
                        <Link
                            key={season}
                            to="/app/prototype/workshop/trading-period"
                            search={{ round, season }}
                            title={`${SEASON_META[season].label} — ${status}`}
                            className={cn(
                                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                                status === "done" &&
                                    "bg-success/15 border-success/40 text-success",
                                status === "current" &&
                                    "bg-warning/20 border-warning/50 text-warning",
                                status === "upcoming" &&
                                    "border-border text-muted-foreground pointer-events-none",
                                isCurrent &&
                                    "ring-2 ring-brand ring-offset-1 ring-offset-surface-card",
                                clickable &&
                                    "hover:scale-105 transition-transform",
                            )}
                        >
                            <Icon className="size-3.5" />
                            <span>{SEASON_META[season].label}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

function RecapNode({
    round,
    isCurrent,
    isClickable,
    isFinal = false,
}: {
    round: number;
    isCurrent: boolean;
    isClickable: boolean;
    /**
     * The session-end recap, after the last round, rather than a between-rounds
     * one.
     */
    isFinal?: boolean;
}) {
    const content = (
        <div
            className={cn(
                "flex flex-col items-center gap-1 px-2 shrink-0",
                !isClickable && "opacity-30",
            )}
        >
            <div
                className={cn(
                    "flex size-7 items-center justify-center rounded-full border",
                    isCurrent
                        ? "bg-brand text-brand-fg border-brand ring-2 ring-brand ring-offset-1 ring-offset-surface-card"
                        : "bg-muted border-border text-muted-foreground",
                )}
            >
                <Sparkles className="size-4" />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
                {isFinal ? "Final recap" : "Recap"}
            </span>
        </div>
    );
    return (
        <div className="flex items-center gap-2">
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            {isClickable ? (
                <Link
                    to="/app/prototype/workshop/recap"
                    search={{ round }}
                    title={
                        isFinal
                            ? `Round ${round} — session-end recap`
                            : `Round ${round} → Round ${round + 1} recap`
                    }
                >
                    {content}
                </Link>
            ) : (
                content
            )}
            {!isFinal && (
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Collapsible price-setting panel — pushes content, doesn't overlay it.
// ---------------------------------------------------------------------------

// Sensible per-catalog-id starting points — roughly each type's own marginal
// cost, so the panel doesn't open on a wall of zeroes. Storage gets a
// buy (charge) and a sell (discharge) price: it's a price-taker on both
// sides of the market, unlike a generator which only ever sells.
const DEFAULT_PRICE: Record<string, number> = {
    onshore_wind_turbine: 6,
    offshore_wind_turbine: 7,
    coal_burner: 68,
    gas_burner: 52,
    combined_cycle: 48,
    water_dam: 12,
    nuclear_reactor: 18,
    pv_solar: 4,
    csp: 15,
};
const DEFAULT_STORAGE_PRICE: Record<string, { buy: number; sell: number }> = {
    lithium_ion_batteries: { buy: 20, sell: 85 },
};

/** Owned, operating facilities grouped by catalog id, generation vs. storage. */
function operatingFleetByCatalog() {
    const counts = new Map<string, number>();
    for (const f of FLEET) {
        if (f.status !== "operating") continue;
        counts.set(f.catalogId, (counts.get(f.catalogId) ?? 0) + 1);
    }
    const generation: Array<{
        catalog: (typeof CATALOG)[number];
        count: number;
    }> = [];
    const storage: Array<{ catalog: (typeof CATALOG)[number]; count: number }> =
        [];
    for (const [catalogId, count] of counts) {
        const catalog = CATALOG.find((c) => c.id === catalogId);
        if (!catalog) continue;
        (catalog.isStorage ? storage : generation).push({ catalog, count });
    }
    return { generation, storage };
}

const { generation: GENERATION_FLEET, storage: STORAGE_FLEET } =
    operatingFleetByCatalog();

export function PriceSettingPanel({
    open,
    onClose,
    seasonLabel = "Summer",
    roundNumber = SESSION.currentRound,
}: {
    open: boolean;
    onClose: () => void;
    seasonLabel?: string;
    roundNumber?: number;
}) {
    const [prices, setPrices] = useState<Record<string, number>>(() =>
        Object.fromEntries(
            GENERATION_FLEET.map(({ catalog }) => [
                catalog.id,
                DEFAULT_PRICE[catalog.id] ?? 20,
            ]),
        ),
    );
    const [storagePrices, setStoragePrices] = useState<
        Record<string, { buy: number; sell: number }>
    >(() =>
        Object.fromEntries(
            STORAGE_FLEET.map(({ catalog }) => [
                catalog.id,
                DEFAULT_STORAGE_PRICE[catalog.id] ?? { buy: 20, sell: 80 },
            ]),
        ),
    );
    const [submitted, setSubmitted] = useState(false);

    return (
        <div
            className={cn(
                "shrink-0 overflow-hidden border-l border-border-brand bg-surface-card transition-[width] duration-200 ease-out",
                open ? "w-[27rem]" : "w-0",
            )}
        >
            <div className="w-[27rem] h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">
                            Round {roundNumber}
                        </div>
                        <div className="font-semibold font-titles">
                            Set your prices — {seasonLabel}
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onClose}
                        aria-label="Close price panel"
                    >
                        <X className="size-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        These hold for the entire {seasonLabel} trading period —
                        every settlement point clears against them. Once the
                        window closes, they can&apos;t be changed.
                    </p>

                    <div className="flex items-center gap-2 rounded-full border w-fit border-warning/30 bg-warning/15 text-warning px-3 py-1 text-sm font-medium">
                        <span>Price-setting closes in</span>
                        <span className="font-mono tabular-nums">02:47</span>
                    </div>

                    <div className="space-y-2">
                        {GENERATION_FLEET.map(({ catalog, count }) => {
                            const Icon = CATEGORY_META[catalog.category].icon;
                            return (
                                <div
                                    key={catalog.id}
                                    className="rounded-lg border border-border p-3 space-y-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon className="size-4 text-brand shrink-0" />
                                        <span className="text-sm font-medium truncate">
                                            {catalog.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                            {count}× ·{" "}
                                            {catalog.powerMw! * count} MW
                                        </span>
                                    </div>
                                    <PriceField
                                        label="Sell price"
                                        value={prices[catalog.id] ?? 0}
                                        onChange={(v) => {
                                            setPrices((p) => ({
                                                ...p,
                                                [catalog.id]: v,
                                            }));
                                            setSubmitted(false);
                                        }}
                                    />
                                </div>
                            );
                        })}

                        {STORAGE_FLEET.map(({ catalog, count }) => {
                            const Icon = CATEGORY_META[catalog.category].icon;
                            const current = storagePrices[catalog.id] ?? {
                                buy: 0,
                                sell: 0,
                            };
                            return (
                                <div
                                    key={catalog.id}
                                    className="rounded-lg border border-border p-3 space-y-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon className="size-4 text-brand shrink-0" />
                                        <span className="text-sm font-medium truncate">
                                            {catalog.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                            {count}× ·{" "}
                                            {catalog.storageCapacityMwh! *
                                                count}{" "}
                                            MWh
                                        </span>
                                    </div>
                                    <PriceField
                                        label="Buy (charge) price"
                                        value={current.buy}
                                        onChange={(v) => {
                                            setStoragePrices((p) => ({
                                                ...p,
                                                [catalog.id]: {
                                                    ...current,
                                                    buy: v,
                                                },
                                            }));
                                            setSubmitted(false);
                                        }}
                                    />
                                    <PriceField
                                        label="Sell (discharge) price"
                                        value={current.sell}
                                        onChange={(v) => {
                                            setStoragePrices((p) => ({
                                                ...p,
                                                [catalog.id]: {
                                                    ...current,
                                                    sell: v,
                                                },
                                            }));
                                            setSubmitted(false);
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <Button
                        className="w-full"
                        onClick={() => setSubmitted(true)}
                    >
                        {submitted ? (
                            <>
                                <Check className="size-4" /> Prices locked in
                            </>
                        ) : (
                            "Lock in prices"
                        )}
                    </Button>
                    {submitted && (
                        <p className="text-xs text-muted-foreground text-center">
                            You can still change them until the window closes.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function PriceField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground w-40 shrink-0">{label}</span>
            <span className="text-muted-foreground">€</span>
            <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-1 font-mono"
            />
            <span className="text-muted-foreground shrink-0">/MWh</span>
        </label>
    );
}

/** Deliberately loud — reachable-from-anywhere only works if it's easy to spot. */
export function PriceSettingToggle({
    open,
    onToggle,
}: {
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <Button
            size="lg"
            onClick={onToggle}
            className={cn(
                "shrink-0 font-semibold shadow-md bg-warning text-warning-foreground hover:bg-warning/90",
                open && "ring-2 ring-warning ring-offset-2 ring-offset-topbar",
            )}
        >
            <Tags className="size-4" />
            Set prices
        </Button>
    );
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

export function WorkshopTopBar({
    phaseLabel,
    phaseKind,
    phaseSeconds,
    priceLockedIn,
    carbonTaxActive,
    panelOpen,
    onTogglePanel,
}: {
    phaseLabel: string;
    phaseKind: PhaseKind;
    phaseSeconds: number | null;
    priceLockedIn?: boolean;
    carbonTaxActive?: boolean;
    panelOpen: boolean;
    onTogglePanel: () => void;
}) {
    return (
        <header className="shrink-0 z-10 flex h-14 items-center border-b border-border-brand bg-topbar px-4 gap-3">
            <Link
                to="/app/prototype/workshop/investment"
                className="flex items-center gap-1.5 shrink-0"
            >
                <Logo className="size-8 fill-foreground" />
                <TypographyBrand className="hidden sm:block text-lg mr-1">
                    Energetica
                </TypographyBrand>
                <span className="hidden md:inline text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    Workshop
                </span>
            </Link>

            <Separator
                orientation="vertical"
                className="bg-border-brand data-[orientation=vertical]:h-4"
            />

            {/* Left cluster: current phase + status badges */}
            <div className="flex items-center gap-3 shrink-0">
                <PhaseCountdown
                    label={phaseLabel}
                    kind={phaseKind}
                    initialSeconds={phaseSeconds}
                />
                {priceLockedIn && (
                    <span className="hidden md:inline-flex items-center gap-1 text-xs text-success">
                        <Check className="size-3.5" /> Your price is locked in
                        for this period
                    </span>
                )}
                {carbonTaxActive && (
                    <span
                        title="Carbon tax passed this round — you're charged per ton of CO₂ emitted, redistributed evenly across all players."
                        className="hidden sm:inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 text-brand px-2.5 py-1 text-xs font-medium"
                    >
                        <Lock className="size-3 rotate-0" />
                        Carbon tax: active
                    </span>
                )}
            </div>

            {/* Center: money — same placement as the persistent-world top bar */}
            <div className="flex-1 flex justify-center items-center min-w-0">
                <Money amount={128400} iconSize="lg" />
            </div>

            <PriceSettingToggle open={panelOpen} onToggle={onTogglePanel} />
        </header>
    );
}

// ---------------------------------------------------------------------------
// Full chrome wrapper
// ---------------------------------------------------------------------------

export function WorkshopChrome({
    phaseLabel,
    phaseKind,
    phaseSeconds,
    priceLockedIn,
    carbonTaxActive = true,
    timeline,
    defaultPanelOpen = false,
    priceSeasonLabel,
    children,
}: {
    phaseLabel: string;
    phaseKind: PhaseKind;
    phaseSeconds: number | null;
    priceLockedIn?: boolean;
    carbonTaxActive?: boolean;
    timeline: TimelineProps;
    defaultPanelOpen?: boolean;
    priceSeasonLabel?: string;
    children: ReactNode;
}) {
    const [panelOpen, setPanelOpen] = useState(defaultPanelOpen);

    return (
        <div className="flex h-svh w-full flex-col overflow-hidden bg-background">
            <WorkshopTopBar
                phaseLabel={phaseLabel}
                phaseKind={phaseKind}
                phaseSeconds={phaseSeconds}
                priceLockedIn={priceLockedIn}
                carbonTaxActive={carbonTaxActive}
                panelOpen={panelOpen}
                onTogglePanel={() => setPanelOpen((o) => !o)}
            />
            <WorkshopTimeline {...timeline} />
            <div className="flex flex-1 min-h-0">
                <main className="flex-1 min-w-0 overflow-auto">
                    <div className="max-w-[1400px] mx-auto p-4 md:p-8">
                        {children}
                    </div>
                </main>
                <PriceSettingPanel
                    open={panelOpen}
                    onClose={() => setPanelOpen(false)}
                    seasonLabel={priceSeasonLabel}
                    roundNumber={timeline.currentRound}
                />
            </div>
            <PrototypeRibbon />
        </div>
    );
}
