/**
 * PROTOTYPE — throwaway. Answers wayfinder ticket #918 (Round-config page UI)
 * on the Workshop Mode map (#880): what should the moderator's per-round
 * lever-setting screen look like? See `.claude/skills/prototype/UI.md`.
 *
 * Three structurally different variants of a brand-new page — Workshop Mode
 * isn't built yet, so there's no existing route to host them on (prototype
 * sub-shape B). Switch via `?variant=A|B|C` or the floating bottom bar.
 *
 * Lever catalog is the real one resolved on #917 (Felix, 2026-07-30) — not
 * invented for this prototype. State is in-memory only; nothing persists and
 * nothing calls the backend.
 *
 * Delete this route (and prototype-switcher.tsx, if nothing else uses it) once
 * a variant is picked and folded into the real page.
 */
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Newspaper } from "lucide-react";
import { useState } from "react";

import { PrototypeSwitcher } from "@/components/dev/prototype-switcher";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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

// ─── Lever catalog (from #917's resolution comment, 2026-07-30) ────────────

type Category = "facility" | "market" | "events";

const CATEGORY_LABEL: Record<Category, string> = {
    facility: "Facility & Investment",
    market: "Fuel & Market",
    events: "Events & Storytelling",
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
    axis: "difficulty" | "fidelity" | "narrative";
    label: string;
    tiers: [Tier, Tier] | [Tier, Tier, Tier];
    /**
     * Canned recap-page headline previewed when this lever is off its default
     * tier. Event levers only.
     */
    headline?: string;
}

const LEVERS: Lever[] = [
    {
        id: "facility-properties",
        category: "facility",
        axis: "difficulty",
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
        axis: "narrative",
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
        axis: "difficulty",
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
        axis: "fidelity",
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
        axis: "difficulty",
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
        axis: "difficulty",
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
        axis: "difficulty",
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
        axis: "difficulty",
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
    {
        id: "climate",
        category: "events",
        axis: "narrative",
        label: "Climate events",
        tiers: [
            { id: "off", label: "Off", detail: "No climate events this round" },
            {
                id: "on",
                label: "On",
                detail: "Severity scales with players' pollution levels",
            },
        ],
        headline: "Freak heatwave strains cooling systems across the grid.",
    },
    {
        id: "geopolitical",
        category: "events",
        axis: "narrative",
        label: "Geopolitical events",
        tiers: [
            {
                id: "off",
                label: "Off",
                detail: "No geopolitical events this round",
            },
            {
                id: "on",
                label: "On",
                detail: "Can move fuel / imported-tech prices",
            },
        ],
        headline: "Border dispute disrupts a key fuel corridor.",
    },
    {
        id: "price-shocks",
        category: "events",
        axis: "narrative",
        label: "Price shocks",
        tiers: [
            { id: "off", label: "Off", detail: "No price shocks this round" },
            {
                id: "on",
                label: "On",
                detail: "± swings from shortages or tech breakthroughs",
            },
        ],
        headline: "Turbine breakthrough undercuts new gas contracts.",
    },
    {
        id: "demand-shift",
        category: "events",
        axis: "narrative",
        label: "Demand shifts",
        tiers: [
            {
                id: "off",
                label: "Off",
                detail: "Demand tracks the seasonal curve as normal",
            },
            {
                id: "on",
                label: "On",
                detail: "Demand deviates from forecast — ideally paired with another event so it tracks expected supply",
            },
        ],
        headline: "A cold snap pushes evening demand above forecast.",
    },
    {
        id: "carbon-tax",
        category: "events",
        axis: "narrative",
        label: "Carbon tax",
        tiers: [
            {
                id: "off",
                label: "Off",
                detail: "No carbon-tax vote this round",
            },
            { id: "on", label: "On", detail: "Players vote to enact it" },
        ],
        headline: "The council calls a snap vote on carbon pricing.",
    },
];

const CATEGORIES: Category[] = ["facility", "market", "events"];

/**
 * Mock cumulative investment toward each tech-grade unlock — moderator-only
 * context, never shown to players (resolved on #917).
 */
const TECH_INVESTMENT_PROGRESS = [
    { name: "Standard nuclear → Gen-IV", pct: 62 },
    { name: "Li-ion → Solid-state battery", pct: 34 },
    { name: "Single-layer PV → Multi-layer PV", pct: 81 },
];

type RoundConfigState = Record<string, string>;

const DEFAULT_STATE: RoundConfigState = {
    "facility-properties": "easy",
    "tech-grade": "base",
    storage: "batteries",
    "clearing-frequency": "24",
    "round-format": "representative",
    "price-setting": "fixed",
    "fuel-procurement": "auto",
    "bid-transparency": "show-all",
    climate: "off",
    geopolitical: "on",
    "price-shocks": "off",
    "demand-shift": "on",
    "carbon-tax": "off",
};

function activeHeadlines(state: RoundConfigState): string[] {
    return LEVERS.filter(
        (l) => l.headline && currentTier(l, state) !== l.tiers[0].id,
    ).map((l) => l.headline!);
}

function isTierLocked(tier: Tier, state: RoundConfigState): boolean {
    return Boolean(
        tier.requiresFullSeason && state["round-format"] !== "full-season",
    );
}

/**
 * State is always fully populated from DEFAULT_STATE — this just satisfies
 * noUncheckedIndexedAccess.
 */
function currentTier(lever: Lever, state: RoundConfigState): string {
    return state[lever.id] ?? lever.tiers[0].id;
}

const AXIS_STYLE: Record<Lever["axis"], string> = {
    difficulty:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    fidelity:
        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    narrative:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function AxisBadge({ axis }: { axis: Lever["axis"] }) {
    return (
        <span
            className={cn(
                "inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                AXIS_STYLE[axis],
            )}
        >
            {axis}
        </span>
    );
}

// ─── Shared: segmented tier picker (used by Variant A & B) ─────────────────

function TierPicker({
    lever,
    state,
    onSetTier,
}: {
    lever: Lever;
    state: RoundConfigState;
    onSetTier: (leverId: string, tierId: string) => void;
}) {
    return (
        <SegmentedPicker
            value={currentTier(lever, state)}
            onValueChange={(tierId) => onSetTier(lever.id, tierId)}
        >
            {lever.tiers.map((tier) => (
                <SegmentedPickerOption
                    key={tier.id}
                    value={tier.id}
                    disabled={isTierLocked(tier, state)}
                    title={
                        isTierLocked(tier, state)
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

function selectedDetail(lever: Lever, state: RoundConfigState): string {
    return (
        lever.tiers.find((t) => t.id === currentTier(lever, state))?.detail ??
        ""
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Variant A — single scroll, every lever visible, headlines shown inline
// ═════════════════════════════════════════════════════════════════════════

function VariantA({
    state,
    onSetTier,
}: {
    state: RoundConfigState;
    onSetTier: (leverId: string, tierId: string) => void;
}) {
    return (
        <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
            <div>
                <TypographyH1>Round configuration</TypographyH1>
                <TypographyLead>
                    Round 3 of the session. Every lever, always visible — set
                    what you need, leave the rest.
                </TypographyLead>
            </div>

            {CATEGORIES.map((category) => (
                <Card key={category}>
                    <CardHeader>
                        <CardTitle>{CATEGORY_LABEL[category]}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {LEVERS.filter((l) => l.category === category).map(
                            (lever) => (
                                <div key={lever.id} className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium">
                                            {lever.label}
                                        </span>
                                        <AxisBadge axis={lever.axis} />
                                    </div>
                                    <TierPicker
                                        lever={lever}
                                        state={state}
                                        onSetTier={onSetTier}
                                    />
                                    <TypographyMuted>
                                        {selectedDetail(lever, state)}
                                    </TypographyMuted>

                                    {lever.id === "tech-grade" &&
                                        state["tech-grade"] ===
                                            "unlockable" && (
                                            <div className="mt-2 space-y-2 rounded-md border border-border p-3">
                                                <TypographyMuted className="font-medium">
                                                    Cumulative investment
                                                    (moderator only — never
                                                    shown to players)
                                                </TypographyMuted>
                                                {TECH_INVESTMENT_PROGRESS.map(
                                                    (t) => (
                                                        <ProgressBar
                                                            key={t.name}
                                                            label={t.name}
                                                            value={t.pct}
                                                        />
                                                    ),
                                                )}
                                            </div>
                                        )}

                                    {lever.headline &&
                                        currentTier(lever, state) !== "off" && (
                                            <InfoBanner>
                                                <div className="flex items-start gap-2">
                                                    <Newspaper className="size-4 mt-0.5 shrink-0" />
                                                    <span>
                                                        Recap headline
                                                        (auto-selected):{" "}
                                                        <em>
                                                            &ldquo;
                                                            {lever.headline}
                                                            &rdquo;
                                                        </em>
                                                    </span>
                                                </div>
                                            </InfoBanner>
                                        )}
                                </div>
                            ),
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Variant B — category tabs + persistent context rail (global, any tab)
// ═════════════════════════════════════════════════════════════════════════

function VariantB({
    state,
    onSetTier,
}: {
    state: RoundConfigState;
    onSetTier: (leverId: string, tierId: string) => void;
}) {
    const [activeCategory, setActiveCategory] = useState<Category>("facility");
    const headlines = activeHeadlines(state);

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
            <div>
                <TypographyH1>Round configuration</TypographyH1>
                <TypographyLead>Round 3 of the session.</TypographyLead>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
                <div className="space-y-6">
                    <SegmentedPicker
                        value={activeCategory}
                        onValueChange={(v) => setActiveCategory(v as Category)}
                    >
                        {CATEGORIES.map((c) => (
                            <SegmentedPickerOption key={c} value={c}>
                                {CATEGORY_LABEL[c]}
                            </SegmentedPickerOption>
                        ))}
                    </SegmentedPicker>

                    <Card>
                        <CardContent className="space-y-6 pt-6">
                            {LEVERS.filter(
                                (l) => l.category === activeCategory,
                            ).map((lever) => (
                                <div key={lever.id} className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium">
                                            {lever.label}
                                        </span>
                                        <AxisBadge axis={lever.axis} />
                                    </div>
                                    <TierPicker
                                        lever={lever}
                                        state={state}
                                        onSetTier={onSetTier}
                                    />
                                    <TypographyMuted>
                                        {selectedDetail(lever, state)}
                                    </TypographyMuted>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Persistent context rail — visible regardless of active tab */}
                <div className="space-y-4 lg:sticky lg:top-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                This round&rsquo;s narrative queue
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {headlines.length === 0 ? (
                                <TypographyMuted>
                                    No event levers are on — nothing will run on
                                    the recap page.
                                </TypographyMuted>
                            ) : (
                                <ul className="space-y-2">
                                    {headlines.map((h) => (
                                        <li
                                            key={h}
                                            className="flex items-start gap-2 text-sm"
                                        >
                                            <Newspaper className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                                            <em>&ldquo;{h}&rdquo;</em>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    {state["tech-grade"] === "unlockable" && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Tech investment (moderator only)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {TECH_INVESTMENT_PROGRESS.map((t) => (
                                    <ProgressBar
                                        key={t.name}
                                        label={t.name}
                                        value={t.pct}
                                    />
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Variant C — dense table across all categories, headlines withheld behind
// an explicit "Preview recap" action (moderator stays blind by default)
// ═════════════════════════════════════════════════════════════════════════

function VariantC({
    state,
    onSetTier,
}: {
    state: RoundConfigState;
    onSetTier: (leverId: string, tierId: string) => void;
}) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const headlines = activeHeadlines(state);

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <TypographyH1>Round configuration</TypographyH1>
                    <TypographyLead>Round 3 of the session.</TypographyLead>
                </div>
                <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                    <Newspaper className="size-4" />
                    Preview recap
                </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                        <tr>
                            <th className="px-3 py-2 font-medium">Lever</th>
                            <th className="px-3 py-2 font-medium">Category</th>
                            <th className="px-3 py-2 font-medium">Axis</th>
                            <th className="px-3 py-2 font-medium">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {LEVERS.map((lever) => {
                            const selected = lever.tiers.find(
                                (t) => t.id === currentTier(lever, state),
                            )!;
                            const expandable = lever.id === "tech-grade";
                            const isExpanded = expandedId === lever.id;
                            return (
                                <>
                                    <tr
                                        key={lever.id}
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
                                        <td className="px-3 py-2">
                                            <AxisBadge axis={lever.axis} />
                                        </td>
                                        <td
                                            className="px-3 py-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
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
                                                        value={currentTier(
                                                            lever,
                                                            state,
                                                        )}
                                                        onValueChange={(v) =>
                                                            onSetTier(
                                                                lever.id,
                                                                v,
                                                            )
                                                        }
                                                    >
                                                        {lever.tiers.map(
                                                            (tier) => (
                                                                <DropdownMenuRadioItem
                                                                    key={
                                                                        tier.id
                                                                    }
                                                                    value={
                                                                        tier.id
                                                                    }
                                                                    disabled={isTierLocked(
                                                                        tier,
                                                                        state,
                                                                    )}
                                                                >
                                                                    {tier.label}
                                                                </DropdownMenuRadioItem>
                                                            ),
                                                        )}
                                                    </DropdownMenuRadioGroup>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                    {expandable && isExpanded && (
                                        <tr
                                            key={`${lever.id}-detail`}
                                            className="bg-muted/30"
                                        >
                                            <td
                                                colSpan={4}
                                                className="px-3 py-3"
                                            >
                                                <TypographyMuted className="mb-2 block">
                                                    Cumulative investment
                                                    (moderator only — never
                                                    shown to players)
                                                </TypographyMuted>
                                                <div className="space-y-2 max-w-md">
                                                    {TECH_INVESTMENT_PROGRESS.map(
                                                        (t) => (
                                                            <ProgressBar
                                                                key={t.name}
                                                                label={t.name}
                                                                value={t.pct}
                                                            />
                                                        ),
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Round recap preview</DialogTitle>
                        <DialogDescription>
                            What players will see on the recap page once this
                            round closes — the same headlines, nothing more.
                        </DialogDescription>
                    </DialogHeader>
                    {headlines.length === 0 ? (
                        <TypographyMuted>
                            No event levers are on — the recap page will show no
                            headlines this round.
                        </TypographyMuted>
                    ) : (
                        <ul className="space-y-2">
                            {headlines.map((h) => (
                                <li
                                    key={h}
                                    className="flex items-start gap-2 text-sm"
                                >
                                    <Newspaper className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                                    <em>&ldquo;{h}&rdquo;</em>
                                </li>
                            ))}
                        </ul>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Route ───────────────────────────────────────────────────────────────

const VARIANT_NAMES = {
    A: "Single scroll, headlines inline",
    B: "Category tabs + context rail",
    C: "Dense table, recap withheld",
};

function RoundConfigPrototypePage() {
    const navigate = Route.useNavigate();
    const { variant } = Route.useSearch();
    const current = variant ?? "A";
    const [state, setState] = useState<RoundConfigState>(DEFAULT_STATE);

    function onSetTier(leverId: string, tierId: string) {
        setState((prev) => ({ ...prev, [leverId]: tierId }));
    }

    return (
        <AppShell>
            <TypographyH3 className="sr-only">
                Round-config page UI prototype
            </TypographyH3>
            {current === "A" && (
                <VariantA state={state} onSetTier={onSetTier} />
            )}
            {current === "B" && (
                <VariantB state={state} onSetTier={onSetTier} />
            )}
            {current === "C" && (
                <VariantC state={state} onSetTier={onSetTier} />
            )}
            <PrototypeSwitcher
                variants={["A", "B", "C"]}
                current={current}
                names={VARIANT_NAMES}
                onChange={(next) => navigate({ search: { variant: next } })}
            />
        </AppShell>
    );
}
