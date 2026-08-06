/**
 * PROTOTYPE — throwaway. Answers wayfinder ticket #918 (Round-config page UI)
 * on the Workshop Mode map (#880): what should the moderator's per-round
 * lever-setting screen look like? See `.claude/skills/prototype/UI.md`.
 *
 * Round 2 — supersedes the first round (variants A/B/C, still in git history on
 * this branch) after Felix's feedback: liked A's full visibility mixed with C's
 * density, drop the difficulty/fidelity/narrative tags, and the Events &
 * Storytelling section needs real teeth — a pool of severity-graded narrative
 * options the moderator picks from (not a bare on/off), climate pre-suggesting
 * an option from session CO2, and Votes split out as its own section (carbon
 * tax today, room for more later).
 *
 * Three new variants — D, E, F — switchable via `?variant=D|E|F` or the
 * floating bottom bar. Brand-new page (Workshop Mode isn't built yet), so
 * there's no existing route to host them on (prototype sub-shape B).
 *
 * Lever catalog and event/vote content are grounded in the real decisions on
 * #917 and the map's Notes — not invented for this prototype, except the mock
 * session-CO2 figure and progress numbers, which stand in for real data that
 * doesn't exist yet. State is in-memory only; nothing persists and nothing
 * calls the backend.
 *
 * Delete this route (and prototype-switcher.tsx, if nothing else uses it) once
 * a variant is picked and folded into the real page.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronDown, Star } from "lucide-react";
import { Fragment, useState } from "react";

import { PrototypeSwitcher } from "@/components/dev/prototype-switcher";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InfoBanner } from "@/components/ui/info-banner";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { Switch } from "@/components/ui/switch";
import {
    TypographyH1,
    TypographyH3,
    TypographyLead,
    TypographyMuted,
} from "@/components/ui/typography";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/internal/prototype-round-config")({
    component: RoundConfigPrototypePage,
    staticData: {
        title: "Prototype — Round Config",
        routeConfig: { requiredRole: null },
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): { variant?: string } => ({
        variant:
            typeof search.variant === "string" ? search.variant : undefined,
    }),
});

// ─── Facility & market levers (from #917's resolution comment, 2026-07-30) ─
// Event/vote levers moved out of this list — see EVENT_CATEGORIES /
// VOTE_PROPOSALS below, per this round's feedback.

type Category = "facility" | "market";

const CATEGORY_LABEL: Record<Category, string> = {
    facility: "Facility & Investment",
    market: "Fuel & Market",
};

interface Tier {
    id: string;
    label: string;
    detail: string;
    /**
     * Only set on storage's "all storage types" tier — needs round-format =
     * full-season.
     */
    requiresFullSeason?: boolean;
}

interface Lever {
    id: string;
    category: Category;
    label: string;
    tiers: [Tier, Tier] | [Tier, Tier, Tier];
}

const LEVERS: Lever[] = [
    {
        id: "facility-properties",
        category: "facility",
        label: "Facility properties shown",
        tiers: [
            {
                id: "easy",
                label: "Basics",
                detail: "Price, max generation, lifetime, construction time, pollution",
            },
            {
                id: "intermediate",
                label: "+ Operating detail",
                detail: "+ capacity factor (renewables), O&M costs, fuel consumption",
            },
        ],
    },
    {
        id: "tech-grade",
        category: "facility",
        label: "Technology grade",
        tiers: [
            {
                id: "base",
                label: "Base tech only",
                detail: "e.g. standard nuclear, standard battery",
            },
            {
                id: "unlockable",
                label: "Upgrades unlockable",
                detail: "Gen-4 nuclear, solid-state battery, multi-layer PV — unlock as cumulative session-wide investment in the base variant crosses a threshold",
            },
        ],
    },
    {
        id: "storage",
        category: "facility",
        label: "Storage availability",
        tiers: [
            {
                id: "off",
                label: "Disabled",
                detail: "No storage facilities this round",
            },
            {
                id: "batteries",
                label: "Batteries only",
                detail: "Short-duration only — cross-day carryover isn't a viable exploit under representative-day compression",
            },
            {
                id: "all",
                label: "All storage types",
                detail: "Every day is literal, SOC carries across real days exactly as in the persistent world",
                requiresFullSeason: true,
            },
        ],
    },
    {
        id: "clearing-frequency",
        category: "market",
        label: "Market clearings / day",
        tiers: [
            {
                id: "24",
                label: "24 (hourly)",
                detail: "Bids still lock once/day regardless — this only changes how finely the day is resolved",
            },
            {
                id: "96",
                label: "96 (15 min)",
                detail: "Exposes faster intra-day variability",
            },
            {
                id: "288",
                label: "288 (5 min)",
                detail: "Exposes solar's fastest intra-day swings",
            },
        ],
    },
    {
        id: "round-format",
        category: "market",
        label: "Trading round format",
        tiers: [
            {
                id: "representative",
                label: "4 representative days",
                detail: "One day per season, compressed",
            },
            {
                id: "full-season",
                label: "Full season (~91 days)",
                detail: "Every day literal — unlocks all storage types",
            },
        ],
    },
    {
        id: "price-setting",
        category: "market",
        label: "Price setting",
        tiers: [
            {
                id: "fixed",
                label: "Defaults, fixed",
                detail: "Moderator-set defaults, not editable by players",
            },
            {
                id: "player-set",
                label: "Player-adjustable",
                detail: "Default prices exist; players can change generation bids and storage bid/ask",
            },
        ],
    },
    {
        id: "fuel-procurement",
        category: "market",
        label: "Fuel procurement",
        tiers: [
            {
                id: "auto",
                label: "Automatic",
                detail: "Rolled into investment — no separate purchase step",
            },
            {
                id: "manual",
                label: "Player-purchased",
                detail: "Players buy the right amount during the investment phase",
            },
        ],
    },
    {
        id: "bid-transparency",
        category: "market",
        label: "Bid / outcome transparency",
        tiers: [
            {
                id: "show-all",
                label: "Show all bids & costs",
                detail: "Shared teaching moment after each day's clearing",
            },
            {
                id: "own-only",
                label: "Own result only",
                detail: "Only the clearing price and the player's own result — closer to a real market",
            },
        ],
    },
];

/**
 * Mock cumulative investment toward each tech-grade unlock — moderator-only
 * context, never shown to players (resolved on #917).
 */
const TECH_INVESTMENT_PROGRESS = [
    { name: "Standard nuclear → Gen-IV", pct: 62 },
    { name: "Li-ion → Solid-state battery", pct: 34 },
    { name: "Single-layer PV → Multi-layer PV", pct: 81 },
];

type TierState = Record<string, string>;

const DEFAULT_TIERS: TierState = {
    "facility-properties": "easy",
    "tech-grade": "base",
    storage: "batteries",
    "clearing-frequency": "24",
    "round-format": "representative",
    "price-setting": "fixed",
    "fuel-procurement": "auto",
    "bid-transparency": "show-all",
};

function isTierLocked(tier: Tier, tiers: TierState): boolean {
    return Boolean(
        tier.requiresFullSeason && tiers["round-format"] !== "full-season",
    );
}

/**
 * State is always fully populated from DEFAULT_TIERS — this just satisfies
 * noUncheckedIndexedAccess.
 */
function currentTier(lever: Lever, tiers: TierState): string {
    return tiers[lever.id] ?? lever.tiers[0].id;
}

function selectedDetail(lever: Lever, tiers: TierState): string {
    return (
        lever.tiers.find((t) => t.id === currentTier(lever, tiers))?.detail ??
        ""
    );
}

// ─── Shared: segmented tier picker ──────────────────────────────────────────

function TierPicker({
    lever,
    tiers,
    onSetTier,
}: {
    lever: Lever;
    tiers: TierState;
    onSetTier: (leverId: string, tierId: string) => void;
}) {
    return (
        <SegmentedPicker
            value={currentTier(lever, tiers)}
            onValueChange={(tierId) => onSetTier(lever.id, tierId)}
        >
            {lever.tiers.map((tier) => (
                <SegmentedPickerOption
                    key={tier.id}
                    value={tier.id}
                    disabled={isTierLocked(tier, tiers)}
                    title={
                        isTierLocked(tier, tiers)
                            ? "Only available when trading round format = Full season"
                            : undefined
                    }
                >
                    {tier.label}
                </SegmentedPickerOption>
            ))}
        </SegmentedPicker>
    );
}

function TechGradeProgress() {
    return (
        <div className="space-y-2">
            <TypographyMuted className="font-medium">
                Cumulative investment (moderator only — never shown to players)
            </TypographyMuted>
            {TECH_INVESTMENT_PROGRESS.map((t) => (
                <ProgressBar key={t.name} label={t.name} value={t.pct} />
            ))}
        </div>
    );
}

// ─── Events & Storytelling: a pool of severity-graded narrative options ────
// per category, the moderator picks which ones apply next round — replaces
// round 1's bare on/off toggle per this round's feedback.

type Severity = "minor" | "moderate" | "major";

interface NarrativeOption {
    id: string;
    severity: Severity;
    headline: string;
    /**
     * In-game mechanical effect, shown so the moderator knows what they're
     * picking.
     */
    effect: string;
}

interface EventCategory {
    id: string;
    label: string;
    options: NarrativeOption[];
}

/**
 * Price shocks and geopolitical events are one merged category per #917's
 * follow-up brainstorm (2026-07-30) — "both moved prices with no clear
 * ownership; now a single category." Round 1 wrongly split them; fixed here.
 */
const EVENT_CATEGORIES: EventCategory[] = [
    {
        id: "climate",
        label: "Climate events",
        options: [
            {
                id: "climate-minor",
                severity: "minor",
                headline: "A dry spell trims hydro output for a week.",
                effect: "Hydro output −10% this round",
            },
            {
                id: "climate-moderate",
                severity: "moderate",
                headline:
                    "Freak heatwave strains cooling systems across the grid.",
                effect: "Thermal plants derated, demand +5%",
            },
            {
                id: "climate-major",
                severity: "major",
                headline:
                    "Historic drought slashes hydro capacity region-wide.",
                effect: "Hydro output −40% this round",
            },
        ],
    },
    {
        id: "price-geo",
        label: "Price shocks & geopolitical",
        options: [
            {
                id: "price-geo-minor",
                severity: "minor",
                headline: "Minor sanctions nudge coal import costs up.",
                effect: "Coal fuel price +10%",
            },
            {
                id: "price-geo-moderate",
                severity: "moderate",
                headline: "Border dispute disrupts a key fuel corridor.",
                effect: "Gas fuel price +30%",
            },
            {
                id: "price-geo-major",
                severity: "major",
                headline: "Embargo cuts off the main gas supplier overnight.",
                effect: "Gas unavailable to purchase this round",
            },
        ],
    },
    {
        id: "demand-shift",
        label: "Demand shifts",
        options: [
            {
                id: "demand-minor",
                severity: "minor",
                headline: "Mild weather trims evening demand slightly.",
                effect: "Evening demand −5%",
            },
            {
                id: "demand-moderate",
                severity: "moderate",
                headline: "A cold snap pushes evening demand above forecast.",
                effect: "Evening demand +15%",
            },
            {
                id: "demand-major",
                severity: "major",
                headline: "Heatwave-driven AC load spikes demand region-wide.",
                effect: "Peak demand +25%, sustained across the round",
            },
        ],
    },
];

/** Mock stand-in for real cumulative session emissions data (doesn't exist yet). */
const SESSION_CO2_TONNES = 18_400;

/**
 * Suggestion thresholds — a placeholder shape for "severity scales with
 * players' pollution level" (#917).
 */
const CLIMATE_SUGGESTION_THRESHOLDS: {
    severity: Severity;
    atOrAbove: number;
}[] = [
    { severity: "major", atOrAbove: 20_000 },
    { severity: "moderate", atOrAbove: 12_000 },
    { severity: "minor", atOrAbove: 5_000 },
];

function suggestedClimateOption(): NarrativeOption | undefined {
    const crossed = CLIMATE_SUGGESTION_THRESHOLDS.find(
        (t) => SESSION_CO2_TONNES >= t.atOrAbove,
    );
    if (!crossed) return undefined;
    return EVENT_CATEGORIES.find((c) => c.id === "climate")?.options.find(
        (o) => o.severity === crossed.severity,
    );
}

// ─── Votes — governance-style proposals, separate from narrative events ────
// Only carbon tax exists today; the shape leaves room for more.

interface VoteProposal {
    id: string;
    label: string;
    detail: string;
}

const VOTE_PROPOSALS: VoteProposal[] = [
    {
        id: "carbon-tax",
        label: "Carbon tax",
        detail: "Players vote to enact a per-tonne CO₂ tax starting next round.",
    },
];

type EventSelectionState = Record<string, string[]>;
type VoteState = Record<string, boolean>;

interface RoundConfigState {
    tiers: TierState;
    events: EventSelectionState;
    votes: VoteState;
}

function defaultState(): RoundConfigState {
    const suggested = suggestedClimateOption();
    return {
        tiers: DEFAULT_TIERS,
        events: {
            climate: suggested ? [suggested.id] : [],
            "price-geo": [],
            "demand-shift": [],
        },
        votes: { "carbon-tax": false },
    };
}

const SEVERITY_COLOR: Record<Severity, string> = {
    minor: "bg-emerald-500",
    moderate: "bg-amber-500",
    major: "bg-red-500",
};

function SeverityDot({ severity }: { severity: Severity }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize text-muted-foreground">
            <span
                className={cn("size-2 rounded-full", SEVERITY_COLOR[severity])}
            />
            {severity}
        </span>
    );
}

function EventOptionRow({
    option,
    selected,
    suggested,
    onToggle,
}: {
    option: NarrativeOption;
    selected: boolean;
    suggested: boolean;
    onToggle: () => void;
}) {
    return (
        <label
            htmlFor={`event-option-${option.id}`}
            aria-label={option.headline}
            className={cn(
                "flex items-start gap-3 rounded-md border border-border px-3 py-2 cursor-pointer transition-colors",
                selected ? "border-primary bg-primary/5" : "hover:bg-muted/40",
            )}
        >
            <input
                id={`event-option-${option.id}`}
                type="checkbox"
                checked={selected}
                onChange={onToggle}
                className="mt-1 size-4"
            />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <SeverityDot severity={option.severity} />
                    <span className="font-medium text-sm">
                        {option.headline}
                    </span>
                    {suggested && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                            <Star className="size-3" /> Suggested
                        </span>
                    )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                    {option.effect}
                </div>
            </div>
        </label>
    );
}

function VoteRow({
    vote,
    active,
    onToggle,
}: {
    vote: VoteProposal;
    active: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
            <div>
                <div className="font-medium text-sm">{vote.label}</div>
                <div className="text-xs text-muted-foreground">
                    {vote.detail}
                </div>
            </div>
            <Switch checked={active} onCheckedChange={onToggle} />
        </div>
    );
}

function ClimateSuggestionBanner({
    suggested,
}: {
    suggested: NarrativeOption | undefined;
}) {
    if (!suggested) return null;
    return (
        <InfoBanner>
            Suggested —{" "}
            <strong className="capitalize">{suggested.severity}</strong> based
            on this session&rsquo;s cumulative emissions (
            {SESSION_CO2_TONNES.toLocaleString()} t CO₂). Override freely — the
            moderator always has the final say.
        </InfoBanner>
    );
}

interface VariantProps {
    state: RoundConfigState;
    onSetTier: (leverId: string, tierId: string) => void;
    onToggleEvent: (categoryId: string, optionId: string) => void;
    onToggleVote: (voteId: string) => void;
}

// ═════════════════════════════════════════════════════════════════════════
// Variant D — compact rows (A's full visibility, tightened toward C's
// density), event pools as checklists grouped by category
// ═════════════════════════════════════════════════════════════════════════

function CompactLeverRow({
    lever,
    tiers,
    onSetTier,
}: {
    lever: Lever;
    tiers: TierState;
    onSetTier: (leverId: string, tierId: string) => void;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-x-4 gap-y-1.5 py-2.5 border-b border-border/60 last:border-b-0">
            <div className="font-medium text-sm sm:pt-1.5">{lever.label}</div>
            <div className="space-y-1">
                <TierPicker lever={lever} tiers={tiers} onSetTier={onSetTier} />
                <p className="text-xs text-muted-foreground">
                    {selectedDetail(lever, tiers)}
                </p>
            </div>
        </div>
    );
}

function VariantD({
    state,
    onSetTier,
    onToggleEvent,
    onToggleVote,
}: VariantProps) {
    const suggested = suggestedClimateOption();

    return (
        <div className="p-4 md:p-8 space-y-5 max-w-4xl mx-auto">
            <div>
                <TypographyH1>Round configuration</TypographyH1>
                <TypographyLead>
                    Round 3 of the session — compact rows, full checklists for
                    events and votes.
                </TypographyLead>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Facility & Investment</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    {LEVERS.filter((l) => l.category === "facility").map(
                        (lever) => (
                            <CompactLeverRow
                                key={lever.id}
                                lever={lever}
                                tiers={state.tiers}
                                onSetTier={onSetTier}
                            />
                        ),
                    )}
                    {state.tiers["tech-grade"] === "unlockable" && (
                        <div className="mt-3 rounded-md border border-border p-3">
                            <TechGradeProgress />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Fuel & Market</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    {LEVERS.filter((l) => l.category === "market").map(
                        (lever) => (
                            <CompactLeverRow
                                key={lever.id}
                                lever={lever}
                                tiers={state.tiers}
                                onSetTier={onSetTier}
                            />
                        ),
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Events & Storytelling</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 pt-0">
                    {EVENT_CATEGORIES.map((category) => {
                        const selected = state.events[category.id] ?? [];
                        return (
                            <div key={category.id} className="space-y-2">
                                <h4 className="font-medium text-sm">
                                    {category.label}
                                </h4>
                                {category.id === "climate" && (
                                    <ClimateSuggestionBanner
                                        suggested={suggested}
                                    />
                                )}
                                <div className="space-y-1.5">
                                    {category.options.map((opt) => (
                                        <EventOptionRow
                                            key={opt.id}
                                            option={opt}
                                            selected={selected.includes(opt.id)}
                                            suggested={
                                                category.id === "climate" &&
                                                opt.id === suggested?.id
                                            }
                                            onToggle={() =>
                                                onToggleEvent(
                                                    category.id,
                                                    opt.id,
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Votes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                    {VOTE_PROPOSALS.map((vote) => (
                        <VoteRow
                            key={vote.id}
                            vote={vote}
                            active={state.votes[vote.id] ?? false}
                            onToggle={() => onToggleVote(vote.id)}
                        />
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Variant E — two-column card grid for levers, events/votes as a
// click-to-select tile picker (game-like, closer to a card catalog)
// ═════════════════════════════════════════════════════════════════════════

function VariantE({
    state,
    onSetTier,
    onToggleEvent,
    onToggleVote,
}: VariantProps) {
    const suggested = suggestedClimateOption();

    return (
        <div className="p-4 md:p-8 space-y-5 max-w-5xl mx-auto">
            <div>
                <TypographyH1>Round configuration</TypographyH1>
                <TypographyLead>
                    Round 3 of the session — card grid, narrative events as a
                    picker.
                </TypographyLead>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {LEVERS.map((lever) => (
                    <div
                        key={lever.id}
                        className="rounded-lg border border-border p-3 space-y-1.5"
                    >
                        <div className="font-medium text-sm">{lever.label}</div>
                        <TierPicker
                            lever={lever}
                            tiers={state.tiers}
                            onSetTier={onSetTier}
                        />
                        <p className="text-xs text-muted-foreground">
                            {selectedDetail(lever, state.tiers)}
                        </p>
                        {lever.id === "tech-grade" &&
                            state.tiers["tech-grade"] === "unlockable" && (
                                <div className="pt-1">
                                    <TechGradeProgress />
                                </div>
                            )}
                    </div>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Events & Storytelling</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 pt-0">
                    {EVENT_CATEGORIES.map((category) => (
                        <div key={category.id} className="space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                                <h4 className="font-medium text-sm">
                                    {category.label}
                                </h4>
                                {category.id === "climate" && (
                                    <span className="text-xs text-muted-foreground">
                                        {SESSION_CO2_TONNES.toLocaleString()} t
                                        CO₂ this session
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {category.options.map((opt) => {
                                    const isSelected = (
                                        state.events[category.id] ?? []
                                    ).includes(opt.id);
                                    const isSuggested =
                                        category.id === "climate" &&
                                        opt.id === suggested?.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() =>
                                                onToggleEvent(
                                                    category.id,
                                                    opt.id,
                                                )
                                            }
                                            className={cn(
                                                "w-60 text-left rounded-lg border p-3 transition-colors",
                                                isSelected
                                                    ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                                                    : "border-border hover:bg-muted/40",
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <SeverityDot
                                                    severity={opt.severity}
                                                />
                                                <div className="flex items-center gap-1">
                                                    {isSuggested && (
                                                        <Star className="size-3.5 text-amber-500" />
                                                    )}
                                                    {isSelected && (
                                                        <Check className="size-3.5 text-primary" />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-sm font-medium mt-1">
                                                {opt.headline}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {opt.effect}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card className="border-amber-300/60 dark:border-amber-800/60">
                <CardHeader>
                    <CardTitle>Votes</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                        {VOTE_PROPOSALS.map((vote) => {
                            const active = state.votes[vote.id] ?? false;
                            return (
                                <button
                                    key={vote.id}
                                    type="button"
                                    onClick={() => onToggleVote(vote.id)}
                                    className={cn(
                                        "w-64 text-left rounded-lg border p-3 transition-colors",
                                        active
                                            ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                                            : "border-border hover:bg-muted/40",
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">
                                            {vote.label}
                                        </span>
                                        {active && (
                                            <Check className="size-3.5 text-amber-600" />
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {vote.detail}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Variant F — everything in one dense table (C's motif, carried further):
// event categories and votes are rows too, expanding in place for detail
// ═════════════════════════════════════════════════════════════════════════

function LeverValueCell({
    lever,
    tiers,
    onSetTier,
}: {
    lever: Lever;
    tiers: TierState;
    onSetTier: (leverId: string, tierId: string) => void;
}) {
    const selected = lever.tiers.find(
        (t) => t.id === currentTier(lever, tiers),
    )!;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="justify-between min-w-44"
                >
                    {selected.label}
                    <ChevronDown className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                    value={currentTier(lever, tiers)}
                    onValueChange={(v) => onSetTier(lever.id, v)}
                >
                    {lever.tiers.map((tier) => (
                        <DropdownMenuRadioItem
                            key={tier.id}
                            value={tier.id}
                            disabled={isTierLocked(tier, tiers)}
                        >
                            {tier.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function eventSummary(category: EventCategory, selectedIds: string[]): string {
    if (selectedIds.length === 0) return "None selected";
    return category.options
        .filter((o) => selectedIds.includes(o.id))
        .map((o) => o.severity)
        .join(", ");
}

function SectionHeaderRow({
    label,
    colSpan,
}: {
    label: string;
    colSpan: number;
}) {
    return (
        <tr className="border-t border-border bg-muted/30">
            <td
                colSpan={colSpan}
                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
                {label}
            </td>
        </tr>
    );
}

function VariantF({
    state,
    onSetTier,
    onToggleEvent,
    onToggleVote,
}: VariantProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const suggested = suggestedClimateOption();

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
            <div>
                <TypographyH1>Round configuration</TypographyH1>
                <TypographyLead>
                    Round 3 of the session — one table, expand a row for detail.
                </TypographyLead>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                        <tr>
                            <th className="px-3 py-2 font-medium">Lever</th>
                            <th className="px-3 py-2 font-medium">Category</th>
                            <th className="px-3 py-2 font-medium">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {LEVERS.map((lever) => {
                            const expandable = lever.id === "tech-grade";
                            const isExpanded = expandedId === lever.id;
                            return (
                                <Fragment key={lever.id}>
                                    <tr
                                        className={cn(
                                            "border-t border-border",
                                            expandable && "cursor-pointer",
                                        )}
                                        onClick={
                                            expandable
                                                ? () =>
                                                      setExpandedId(
                                                          isExpanded
                                                              ? null
                                                              : lever.id,
                                                      )
                                                : undefined
                                        }
                                    >
                                        <td className="px-3 py-2 font-medium">
                                            <span className="inline-flex items-center gap-1">
                                                {lever.label}
                                                {expandable && (
                                                    <ChevronDown
                                                        className={cn(
                                                            "size-3.5 text-muted-foreground transition-transform",
                                                            isExpanded &&
                                                                "rotate-180",
                                                        )}
                                                    />
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            {CATEGORY_LABEL[lever.category]}
                                        </td>
                                        <td
                                            className="px-3 py-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <LeverValueCell
                                                lever={lever}
                                                tiers={state.tiers}
                                                onSetTier={onSetTier}
                                            />
                                        </td>
                                    </tr>
                                    {expandable && isExpanded && (
                                        <tr className="bg-muted/30">
                                            <td
                                                colSpan={3}
                                                className="px-3 py-3"
                                            >
                                                <TechGradeProgress />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}

                        <SectionHeaderRow
                            label="Events & storytelling"
                            colSpan={3}
                        />
                        {EVENT_CATEGORIES.map((category) => {
                            const isExpanded = expandedId === category.id;
                            const selectedIds = state.events[category.id] ?? [];
                            return (
                                <Fragment key={category.id}>
                                    <tr
                                        className="border-t border-border cursor-pointer"
                                        onClick={() =>
                                            setExpandedId(
                                                isExpanded ? null : category.id,
                                            )
                                        }
                                    >
                                        <td className="px-3 py-2 font-medium">
                                            <span className="inline-flex items-center gap-1">
                                                {category.label}
                                                <ChevronDown
                                                    className={cn(
                                                        "size-3.5 text-muted-foreground transition-transform",
                                                        isExpanded &&
                                                            "rotate-180",
                                                    )}
                                                />
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            Narrative pool
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground capitalize">
                                            {eventSummary(
                                                category,
                                                selectedIds,
                                            )}
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-muted/30">
                                            <td
                                                colSpan={3}
                                                className="px-3 py-3"
                                            >
                                                <div className="max-w-xl space-y-2">
                                                    {category.id ===
                                                        "climate" && (
                                                        <ClimateSuggestionBanner
                                                            suggested={
                                                                suggested
                                                            }
                                                        />
                                                    )}
                                                    <div className="space-y-1.5">
                                                        {category.options.map(
                                                            (opt) => (
                                                                <EventOptionRow
                                                                    key={opt.id}
                                                                    option={opt}
                                                                    selected={selectedIds.includes(
                                                                        opt.id,
                                                                    )}
                                                                    suggested={
                                                                        category.id ===
                                                                            "climate" &&
                                                                        opt.id ===
                                                                            suggested?.id
                                                                    }
                                                                    onToggle={() =>
                                                                        onToggleEvent(
                                                                            category.id,
                                                                            opt.id,
                                                                        )
                                                                    }
                                                                />
                                                            ),
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}

                        <SectionHeaderRow label="Votes" colSpan={3} />
                        {VOTE_PROPOSALS.map((vote) => (
                            <tr
                                key={vote.id}
                                className="border-t border-border"
                            >
                                <td className="px-3 py-2 font-medium">
                                    {vote.label}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">
                                    {vote.detail}
                                </td>
                                <td className="px-3 py-2">
                                    <Switch
                                        checked={state.votes[vote.id] ?? false}
                                        onCheckedChange={() =>
                                            onToggleVote(vote.id)
                                        }
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Route ───────────────────────────────────────────────────────────────

const VARIANT_NAMES = {
    D: "Compact rows, event checklists",
    E: "Card grid, narrative picker",
    F: "One dense table, expand in place",
};

function RoundConfigPrototypePage() {
    const navigate = Route.useNavigate();
    const { variant } = Route.useSearch();
    const current = variant ?? "D";
    const [state, setState] = useState<RoundConfigState>(defaultState);

    function onSetTier(leverId: string, tierId: string) {
        setState((prev) => ({
            ...prev,
            tiers: { ...prev.tiers, [leverId]: tierId },
        }));
    }

    function onToggleEvent(categoryId: string, optionId: string) {
        setState((prev) => {
            const current = prev.events[categoryId] ?? [];
            const next = current.includes(optionId)
                ? current.filter((id) => id !== optionId)
                : [...current, optionId];
            return { ...prev, events: { ...prev.events, [categoryId]: next } };
        });
    }

    function onToggleVote(voteId: string) {
        setState((prev) => ({
            ...prev,
            votes: { ...prev.votes, [voteId]: !prev.votes[voteId] },
        }));
    }

    const variantProps: VariantProps = {
        state,
        onSetTier,
        onToggleEvent,
        onToggleVote,
    };

    return (
        <AppShell>
            <TypographyH3 className="sr-only">
                Round-config page UI prototype
            </TypographyH3>
            {current === "D" && <VariantD {...variantProps} />}
            {current === "E" && <VariantE {...variantProps} />}
            {current === "F" && <VariantF {...variantProps} />}
            <PrototypeSwitcher
                variants={["D", "E", "F"]}
                current={current}
                names={VARIANT_NAMES}
                onChange={(next) => navigate({ search: { variant: next } })}
            />
        </AppShell>
    );
}
