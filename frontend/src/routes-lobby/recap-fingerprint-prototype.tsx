/**
 * THROWAWAY PROTOTYPE — issue #864 (recap page).
 *
 * Question: what should the "electricity production fingerprint" look like on
 * the recap page? A per-player breakdown of how each player generated their
 * power, grouped by the game's real technology families, so you can tell at a
 * glance who was a nuclear baron, who lived off the wind, who burned coal.
 *
 * Three structurally different variants, switchable via `?variant=A|B|C` and
 * the floating bar at the bottom (or ← / → keys): A — Stacked columns: 100%
 * vertical bars side by side, one per player. B — Fingerprint strips: ranked
 * horizontal rows, dominant modality labeled. C — Radar small-multiples: one
 * star chart per player (the "less promising" idea).
 *
 * Data is SYNTHESIZED here (see FAKE_PLAYERS) — the real recap JSON does not
 * yet carry a per-technology energy breakdown. Technology names/families are
 * lifted from energetica/enums.py so the shapes are realistic.
 *
 * Route: /recap-fingerprint-prototype (lobby frontend: `bun run dev:lobby`)
 * This file is not production code: no tests, no error handling, throwaway.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect } from "react";

import {
    TypographyH2,
    TypographyLead,
    TypographyMuted,
} from "@/components/ui/typography";

// ---------------------------------------------------------------------------
// Technology taxonomy (families → real facility types from enums.py)
// ---------------------------------------------------------------------------

type TechKey =
    | "steam_engine"
    | "coal_burner"
    | "gas_burner"
    | "combined_cycle"
    | "nuclear_reactor"
    | "nuclear_reactor_gen4"
    | "windmill"
    | "onshore_wind_turbine"
    | "offshore_wind_turbine"
    | "watermill"
    | "small_water_dam"
    | "large_water_dam"
    | "CSP_solar"
    | "PV_solar";

type FamilyKey = "fossil" | "nuclear" | "wind" | "hydro" | "solar";

type Family = {
    key: FamilyKey;
    label: string;
    color: string; // base data colour (not a theme token — this is a data scale)
    techs: { key: TechKey; label: string; tint: string }[];
};

// Ordered dirtiest → cleanest so stacks read as an "energy transition" gradient.
const FAMILIES: Family[] = [
    {
        key: "fossil",
        label: "Fossil",
        color: "#78716c",
        techs: [
            { key: "steam_engine", label: "Steam engine", tint: "#a8a29e" },
            { key: "coal_burner", label: "Coal burner", tint: "#78716c" },
            { key: "gas_burner", label: "Gas burner", tint: "#57534e" },
            { key: "combined_cycle", label: "Combined cycle", tint: "#44403c" },
        ],
    },
    {
        key: "nuclear",
        label: "Nuclear",
        color: "#a855f7",
        techs: [
            {
                key: "nuclear_reactor",
                label: "Nuclear reactor",
                tint: "#c084fc",
            },
            {
                key: "nuclear_reactor_gen4",
                label: "Gen-4 reactor",
                tint: "#9333ea",
            },
        ],
    },
    {
        key: "wind",
        label: "Wind",
        color: "#22d3ee",
        techs: [
            { key: "windmill", label: "Windmill", tint: "#a5f3fc" },
            {
                key: "onshore_wind_turbine",
                label: "Onshore turbine",
                tint: "#22d3ee",
            },
            {
                key: "offshore_wind_turbine",
                label: "Offshore turbine",
                tint: "#0891b2",
            },
        ],
    },
    {
        key: "hydro",
        label: "Hydro",
        color: "#3b82f6",
        techs: [
            { key: "watermill", label: "Watermill", tint: "#93c5fd" },
            { key: "small_water_dam", label: "Small dam", tint: "#3b82f6" },
            { key: "large_water_dam", label: "Large dam", tint: "#1d4ed8" },
        ],
    },
    {
        key: "solar",
        label: "Solar",
        color: "#f59e0b",
        techs: [
            { key: "CSP_solar", label: "CSP solar", tint: "#fbbf24" },
            { key: "PV_solar", label: "PV solar", tint: "#f59e0b" },
        ],
    },
];

const TECH_META = new Map<
    TechKey,
    { label: string; tint: string; family: Family }
>();
for (const fam of FAMILIES) {
    for (const t of fam.techs) {
        TECH_META.set(t.key, { label: t.label, tint: t.tint, family: fam });
    }
}

// ---------------------------------------------------------------------------
// Synthesized data — the recap artifact does not (yet) carry this breakdown.
// Values are lifetime energy produced per technology, in GWh.
// ---------------------------------------------------------------------------

type Player = {
    id: string;
    name: string;
    blurb: string; // just to make the prototype fun to read
    production: Partial<Record<TechKey, number>>;
};

const FAKE_PLAYERS: Player[] = [
    {
        id: "p1",
        name: "Atomkraft AG",
        blurb: "All-in on fission",
        production: {
            steam_engine: 40,
            coal_burner: 120,
            nuclear_reactor: 1400,
            nuclear_reactor_gen4: 900,
            onshore_wind_turbine: 90,
            PV_solar: 60,
        },
    },
    {
        id: "p2",
        name: "Sonnenkönig",
        blurb: "Chased the sun",
        production: {
            steam_engine: 30,
            gas_burner: 80,
            CSP_solar: 520,
            PV_solar: 1350,
            onshore_wind_turbine: 210,
            small_water_dam: 140,
        },
    },
    {
        id: "p3",
        name: "Kohle & Co.",
        blurb: "Never left the 19th century",
        production: {
            steam_engine: 260,
            coal_burner: 1500,
            gas_burner: 480,
            combined_cycle: 320,
            windmill: 40,
        },
    },
    {
        id: "p4",
        name: "Windfänger",
        blurb: "Rode every gust",
        production: {
            windmill: 120,
            onshore_wind_turbine: 900,
            offshore_wind_turbine: 780,
            combined_cycle: 260,
            PV_solar: 180,
            large_water_dam: 220,
        },
    },
    {
        id: "p5",
        name: "Talsperre GmbH",
        blurb: "Dammed every river",
        production: {
            watermill: 90,
            small_water_dam: 340,
            large_water_dam: 1180,
            onshore_wind_turbine: 260,
            PV_solar: 150,
            gas_burner: 210,
        },
    },
    {
        id: "p6",
        name: "Ausgewogen",
        blurb: "A little of everything",
        production: {
            combined_cycle: 380,
            nuclear_reactor: 420,
            onshore_wind_turbine: 360,
            offshore_wind_turbine: 240,
            large_water_dam: 300,
            PV_solar: 340,
            CSP_solar: 120,
        },
    },
];

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

type Segment = {
    tech: TechKey;
    label: string;
    tint: string;
    family: Family;
    gwh: number;
    share: number; // 0..1 of this player's total
};

function playerSegments(player: Player): {
    segments: Segment[];
    total: number;
    familyShares: { family: Family; share: number; gwh: number }[];
    dominant: Family;
} {
    const total = Object.values(player.production).reduce((a, b) => a + b, 0);
    // Keep FAMILIES order (dirtiest → cleanest) so every player's stack aligns.
    const segments: Segment[] = [];
    for (const fam of FAMILIES) {
        for (const t of fam.techs) {
            const gwh = player.production[t.key];
            if (!gwh) continue;
            segments.push({
                tech: t.key,
                label: t.label,
                tint: t.tint,
                family: fam,
                gwh,
                share: gwh / total,
            });
        }
    }
    const familyShares = FAMILIES.map((family) => {
        const gwh = family.techs.reduce(
            (a, t) => a + (player.production[t.key] ?? 0),
            0,
        );
        return { family, gwh, share: gwh / total };
    });
    const dominant = [...familyShares].sort((a, b) => b.share - a.share)[0]!
        .family;
    return { segments, total, familyShares, dominant };
}

const fmtGwh = (g: number) =>
    g >= 1000 ? `${(g / 1000).toFixed(1)} TWh` : `${Math.round(g)} GWh`;
const pct = (s: number) => `${Math.round(s * 100)}%`;

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function FamilyLegend() {
    return (
        <div className="flex flex-wrap gap-x-5 gap-y-2">
            {FAMILIES.map((fam) => (
                <div key={fam.key} className="flex items-center gap-1.5">
                    <span
                        className="inline-block h-3 w-3 rounded-sm"
                        style={{ backgroundColor: fam.color }}
                    />
                    <span className="text-xs font-medium">{fam.label}</span>
                </div>
            ))}
        </div>
    );
}

function PageIntro() {
    return (
        <div className="flex flex-col gap-2">
            <TypographyH2 className="text-primary">
                Production fingerprint
            </TypographyH2>
            <TypographyLead>How each player kept the lights on.</TypographyLead>
            <TypographyMuted>
                Synthesized data · 6 players · grouped by the game&apos;s real
                technology families.
            </TypographyMuted>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Variant A — Stacked columns (the primary idea)
// Vertical 100% stacked bars, one per player, side by side.
// ---------------------------------------------------------------------------

function VariantA() {
    const players = FAKE_PLAYERS;
    return (
        <div className="flex flex-col gap-8">
            <PageIntro />
            <FamilyLegend />
            <div className="flex items-end gap-4 overflow-x-auto pb-2">
                {players.map((player) => {
                    const { segments, total, dominant } =
                        playerSegments(player);
                    return (
                        <div
                            key={player.id}
                            className="flex min-w-[92px] flex-1 flex-col items-center gap-2"
                        >
                            <div className="group relative flex h-80 w-16 flex-col overflow-hidden rounded-lg border border-border">
                                {segments.map((seg) => (
                                    <div
                                        key={seg.tech}
                                        className="relative w-full transition-[filter] hover:brightness-110"
                                        style={{
                                            height: `${seg.share * 100}%`,
                                            backgroundColor: seg.tint,
                                        }}
                                        title={`${seg.label} — ${fmtGwh(seg.gwh)} (${pct(seg.share)})`}
                                    >
                                        {seg.share > 0.12 && (
                                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white/90 drop-shadow">
                                                {pct(seg.share)}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col items-center text-center">
                                <span className="text-sm font-semibold leading-tight">
                                    {player.name}
                                </span>
                                <span
                                    className="text-[11px] font-medium"
                                    style={{ color: dominant.color }}
                                >
                                    {dominant.label}-led
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    {fmtGwh(total)}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Variant B — Fingerprint strips
// Horizontal 100% stacked rows, ranked by total output, dominant modality
// called out on the right. Reads like a leaderboard, not a chart.
// ---------------------------------------------------------------------------

function VariantB() {
    const players = [...FAKE_PLAYERS]
        .map((p) => ({ p, d: playerSegments(p) }))
        .sort((a, b) => b.d.total - a.d.total);

    return (
        <div className="flex flex-col gap-8">
            <PageIntro />
            <FamilyLegend />
            <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {players.map(({ p, d }, i) => (
                    <div
                        key={p.id}
                        className="flex items-center gap-4 px-4 py-3"
                    >
                        <span className="w-5 text-center text-sm font-bold tabular-nums text-muted-foreground">
                            {i + 1}
                        </span>
                        <div className="w-32 shrink-0">
                            <div className="text-sm font-semibold leading-tight">
                                {p.name}
                            </div>
                            <div className="text-[11px] italic text-muted-foreground">
                                {p.blurb}
                            </div>
                        </div>
                        <div className="flex h-7 flex-1 overflow-hidden rounded-md border border-border">
                            {d.segments.map((seg) => (
                                <div
                                    key={seg.tech}
                                    className="h-full transition-[filter] hover:brightness-110"
                                    style={{
                                        width: `${seg.share * 100}%`,
                                        backgroundColor: seg.tint,
                                    }}
                                    title={`${seg.label} — ${fmtGwh(seg.gwh)} (${pct(seg.share)})`}
                                />
                            ))}
                        </div>
                        <div className="flex w-28 shrink-0 flex-col items-end">
                            <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                                style={{ backgroundColor: d.dominant.color }}
                            >
                                {d.dominant.label}{" "}
                                {pct(
                                    d.familyShares.find(
                                        (f) => f.family === d.dominant,
                                    )!.share,
                                )}
                            </span>
                            <span className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                                {fmtGwh(d.total)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Variant C — Radar small-multiples (the "less promising" idea)
// One star chart per player. Axes = the 5 families. Hand-rolled SVG.
// ---------------------------------------------------------------------------

function Radar({ player }: { player: Player }) {
    const { familyShares, dominant } = playerSegments(player);
    const size = 150;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 26;
    const n = FAMILIES.length;

    // Scale each axis to the family's own share, but boost so shapes are legible
    // (pure share makes small players look like dots). Cap at 1.
    const maxShare = Math.max(...familyShares.map((f) => f.share), 0.0001);

    const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
    const pointAt = (i: number, radius: number) => {
        const a = angleFor(i);
        return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius] as const;
    };

    const gridRings = [0.33, 0.66, 1];
    const dataPoints = familyShares.map((f, i) =>
        pointAt(i, r * (f.share / maxShare)),
    );
    const dataPath = dataPoints.map(([x, y]) => `${x},${y}`).join(" ") + " Z";

    return (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-3">
            <svg width={size} height={size} className="overflow-visible">
                {/* grid rings */}
                {gridRings.map((g) => (
                    <polygon
                        key={g}
                        points={FAMILIES.map((_, i) => {
                            const [x, y] = pointAt(i, r * g);
                            return `${x},${y}`;
                        }).join(" ")}
                        className="fill-none stroke-border"
                        strokeWidth={1}
                    />
                ))}
                {/* spokes + axis labels */}
                {FAMILIES.map((fam, i) => {
                    const [x, y] = pointAt(i, r);
                    const [lx, ly] = pointAt(i, r + 14);
                    return (
                        <g key={fam.key}>
                            <line
                                x1={cx}
                                y1={cy}
                                x2={x}
                                y2={y}
                                className="stroke-border"
                                strokeWidth={1}
                            />
                            <circle cx={lx} cy={ly} r={3} fill={fam.color} />
                        </g>
                    );
                })}
                {/* data polygon */}
                <polygon
                    points={dataPath}
                    fill={dominant.color}
                    fillOpacity={0.25}
                    stroke={dominant.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                />
                {dataPoints.map(([x, y], i) => (
                    <circle
                        key={FAMILIES[i]!.key}
                        cx={x}
                        cy={y}
                        r={2.5}
                        fill={FAMILIES[i]!.color}
                    />
                ))}
            </svg>
            <span className="text-sm font-semibold">{player.name}</span>
            <span
                className="text-[11px] font-medium"
                style={{ color: dominant.color }}
            >
                {dominant.label}-led
            </span>
        </div>
    );
}

function VariantC() {
    return (
        <div className="flex flex-col gap-8">
            <PageIntro />
            <FamilyLegend />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {FAKE_PLAYERS.map((p) => (
                    <Radar key={p.id} player={p} />
                ))}
            </div>
            <TypographyMuted>
                Note: axes are scaled per-player (each player&apos;s biggest
                family fills the ring), so shapes compare <em>mix</em>, not
                absolute output — which is exactly why this variant is harder to
                read at a glance than A or B.
            </TypographyMuted>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Switcher + route
// ---------------------------------------------------------------------------

const VARIANTS = {
    A: { name: "Stacked columns", render: () => <VariantA /> },
    B: { name: "Fingerprint strips", render: () => <VariantB /> },
    C: { name: "Radar small-multiples", render: () => <VariantC /> },
} as const;
type VariantKey = keyof typeof VARIANTS;
const VARIANT_KEYS = Object.keys(VARIANTS) as VariantKey[];

function PrototypeSwitcher({ current }: { current: VariantKey }) {
    const navigate = useNavigate();
    const go = useCallback(
        (dir: 1 | -1) => {
            const i = VARIANT_KEYS.indexOf(current);
            const next =
                VARIANT_KEYS[
                    (i + dir + VARIANT_KEYS.length) % VARIANT_KEYS.length
                ]!;
            void navigate({
                to: "/recap-fingerprint-prototype",
                search: { variant: next },
            });
        },
        [current, navigate],
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = document.activeElement;
            if (
                el instanceof HTMLInputElement ||
                el instanceof HTMLTextAreaElement ||
                (el as HTMLElement | null)?.isContentEditable
            )
                return;
            if (e.key === "ArrowLeft") go(-1);
            if (e.key === "ArrowRight") go(1);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [go]);

    return (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-foreground px-1.5 py-1.5 text-background shadow-lg">
            <button
                onClick={() => go(-1)}
                className="rounded-full p-1.5 hover:bg-background/20"
                aria-label="Previous variant"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-xs font-medium tabular-nums">
                {current} — {VARIANTS[current].name}
            </span>
            <button
                onClick={() => go(1)}
                className="rounded-full p-1.5 hover:bg-background/20"
                aria-label="Next variant"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
}

export const Route = createFileRoute("/recap-fingerprint-prototype")({
    validateSearch: (search: Record<string, unknown>) => ({
        variant: (VARIANT_KEYS as string[]).includes(search.variant as string)
            ? (search.variant as VariantKey)
            : ("A" as VariantKey),
    }),
    component: PrototypePage,
    staticData: { title: "Recap fingerprint (prototype)" },
});

function PrototypePage() {
    const { variant } = Route.useSearch() as { variant: VariantKey };
    return (
        // Break out of the lobby's narrow max-w-3xl column: a recap page is wide.
        <div className="mx-[calc(50%-50vw)] w-screen px-6 py-8 sm:px-12">
            <div className="mx-auto max-w-5xl">
                {VARIANTS[variant].render()}
            </div>
            {!import.meta.env.PROD && <PrototypeSwitcher current={variant} />}
        </div>
    );
}
