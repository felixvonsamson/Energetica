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
import { SEASON_META } from "@/lib/workshop-prototype/meta";
import {
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

export function WorkshopTimeline({
    currentRound = SESSION.currentRound,
    currentSeason,
    currentRecapForRound,
}: TimelineProps) {
    return (
        <div className="flex items-center gap-1 overflow-x-auto px-4 py-2 border-b border-border-brand bg-surface-card">
            {Array.from({ length: SESSION.totalRounds }, (_, i) => i + 1).map(
                (round, idx) => {
                    const seasonStatus =
                        ROUND_SEASON_STATUS[round] ?? ROUND_SEASON_STATUS[1]!;
                    const roundState: "done" | "current" | "upcoming" =
                        round < currentRound
                            ? "done"
                            : round === currentRound
                              ? "current"
                              : "upcoming";
                    return (
                        <div key={round} className="flex items-center">
                            {idx > 0 && (
                                <RecapNode
                                    round={round - 1}
                                    isCurrent={
                                        currentRecapForRound === round - 1
                                    }
                                    isClickable={round - 1 < currentRound}
                                />
                            )}
                            <div
                                className={cn(
                                    "flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 min-w-[7.5rem]",
                                    roundState === "current" &&
                                        "bg-brand/10 border border-brand/40",
                                    roundState === "upcoming" && "opacity-40",
                                )}
                            >
                                <Link
                                    to="/app/prototype/workshop/round"
                                    search={{ round }}
                                    className={cn(
                                        "text-xs font-semibold tracking-wide",
                                        roundState === "upcoming" &&
                                            "pointer-events-none",
                                        roundState !== "upcoming" &&
                                            "hover:underline",
                                    )}
                                >
                                    Round {round}
                                </Link>
                                <div className="flex items-center gap-1">
                                    {SEASONS.map((season) => {
                                        const status = seasonStatus[season];
                                        const Icon = SEASON_META[season].icon;
                                        const isCurrent =
                                            round === currentRound &&
                                            season === currentSeason;
                                        const clickable = status !== "upcoming";
                                        return (
                                            <Link
                                                key={season}
                                                to="/app/prototype/workshop/trading-period"
                                                search={{ round, season }}
                                                title={`${SEASON_META[season].label} — ${status}`}
                                                className={cn(
                                                    "flex size-6 items-center justify-center rounded-full border",
                                                    status === "done" &&
                                                        "bg-success/15 border-success/40 text-success",
                                                    status === "current" &&
                                                        "bg-warning/20 border-warning/50 text-warning",
                                                    status === "upcoming" &&
                                                        "border-border text-muted-foreground pointer-events-none",
                                                    isCurrent &&
                                                        "ring-2 ring-brand ring-offset-1 ring-offset-surface-card",
                                                    clickable &&
                                                        "hover:scale-110 transition-transform",
                                                )}
                                            >
                                                <Icon className="size-3.5" />
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                },
            )}
        </div>
    );
}

function RecapNode({
    round,
    isCurrent,
    isClickable,
}: {
    round: number;
    isCurrent: boolean;
    isClickable: boolean;
}) {
    const content = (
        <div
            className={cn(
                "flex flex-col items-center gap-0.5 px-2 shrink-0",
                !isClickable && "opacity-30",
            )}
        >
            <div
                className={cn(
                    "flex size-6 items-center justify-center rounded-full border",
                    isCurrent
                        ? "bg-brand text-brand-fg border-brand ring-2 ring-brand ring-offset-1 ring-offset-surface-card"
                        : "bg-muted border-border text-muted-foreground",
                )}
            >
                <Sparkles className="size-3.5" />
            </div>
            <span className="text-[10px] text-muted-foreground">Recap</span>
        </div>
    );
    return (
        <div className="flex items-center gap-1">
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            {isClickable ? (
                <Link
                    to="/app/prototype/workshop/recap"
                    search={{ round }}
                    title={`Round ${round} → Round ${round + 1} recap`}
                >
                    {content}
                </Link>
            ) : (
                content
            )}
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Collapsible price-setting panel — pushes content, doesn't overlay it.
// ---------------------------------------------------------------------------

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
    const [price, setPrice] = useState(46);
    const [submitted, setSubmitted] = useState(false);

    return (
        <div
            className={cn(
                "shrink-0 overflow-hidden border-l border-border-brand bg-surface-card transition-[width] duration-200 ease-out",
                open ? "w-[22rem]" : "w-0",
            )}
        >
            <div className="w-[22rem] h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">
                            Round {roundNumber}
                        </div>
                        <div className="font-semibold font-titles">
                            Set your price — {seasonLabel}
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
                        This price holds for the entire {seasonLabel} trading
                        period — every settlement point clears against it. Once
                        the window closes, it can&apos;t be changed.
                    </p>

                    <div className="flex items-center gap-2 rounded-full border w-fit border-warning/30 bg-warning/15 text-warning px-3 py-1 text-sm font-medium">
                        <span>Price-setting closes in</span>
                        <span className="font-mono tabular-nums">02:47</span>
                    </div>

                    <div className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                                Your offer price
                            </span>
                            <span className="font-mono text-lg font-semibold">
                                €{price}/MWh
                            </span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={150}
                            value={price}
                            onChange={(e) => {
                                setPrice(Number(e.target.value));
                                setSubmitted(false);
                            }}
                            className="w-full accent-brand"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>€0</span>
                            <span>€150</span>
                        </div>
                    </div>

                    <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Fleet capacity available
                            </span>
                            <span>21 MW</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Last round&apos;s clearing avg.
                            </span>
                            <span>€51/MWh</span>
                        </div>
                    </div>

                    <Button
                        className="w-full"
                        onClick={() => setSubmitted(true)}
                    >
                        {submitted ? (
                            <>
                                <Check className="size-4" /> Price locked in
                            </>
                        ) : (
                            "Lock in price"
                        )}
                    </Button>
                    {submitted && (
                        <p className="text-xs text-muted-foreground text-center">
                            You can still change it until the window closes.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export function PriceSettingToggle({
    open,
    onToggle,
}: {
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <Button
            variant={open ? "secondary" : "outline"}
            size="sm"
            onClick={onToggle}
            className="shrink-0"
        >
            <Tags className="size-4" />
            <span className="hidden sm:inline">Set prices</span>
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

            <div className="flex-1 flex items-center gap-3 min-w-0">
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
            </div>

            {carbonTaxActive && (
                <span
                    title="Carbon tax passed this round — you're charged per ton of CO₂ emitted, redistributed evenly across all players."
                    className="hidden sm:inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 text-brand px-2.5 py-1 text-xs font-medium shrink-0"
                >
                    <Lock className="size-3 rotate-0" />
                    Carbon tax: active
                </span>
            )}

            <div className="flex items-center gap-1 shrink-0">
                <Money amount={128400} />
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
