/**
 * The v1 baseline recap page — renders a run's published recap (the frozen
 * tombstone minted at `active → freeze`, T5/G1) on the lobby, once it exists.
 *
 * A retrospective, not a full scoreboard (ADR-0005 / G3) — with one scoped
 * exception (PR #915): operating income, the recap's main metric, gets an
 * actual 1/2/3 podium — gold/silver/bronze medal plus a matching cell tint for
 * the top three. XP and CO2 produced get the same three-tone tint for their own
 * top three (independently ranked, lowest wins for CO2 — the cleanest three,
 * not the biggest emitters) but no medal, so the colour reads as "notable"
 * without a second overall ranking. CO2 is laid bare, un-netted (captured is
 * dropped from view for now, see below). Rows otherwise carry no position; the
 * per-player table defaults to operating-income order ("most consequential
 * first") but every column is sortable.
 *
 * Deliberately baseline, not the full spec (see #864). The layout was settled
 * via a `/prototype` UI exploration (three variants — ledger table, faceted
 * top-movers, map-hero atlas); the ledger won. The full variant set is on the
 * `prototype/864-recap-retrospection` branch.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    ArrowUpDown,
    Factory,
    Scale,
    Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import { RecapMap } from "@/components/lobby/recap/recap-map";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoBanner } from "@/components/ui/info-banner";
import { Money } from "@/components/ui/money";
import { Spinner } from "@/components/ui/spinner";
import { TypographyH1, TypographyMuted } from "@/components/ui/typography";
import { useRecap } from "@/hooks/use-lobby";
import { formatEmissions, formatTimestamp } from "@/lib/format-utils";
import type { RecapRow } from "@/lib/recap";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/runs/$slug/recap")({
    component: RecapPage,
    staticData: { title: "Run recap" },
});

function RecapPage() {
    const { slug } = Route.useParams();
    const recap = useRecap(slug);

    if (recap.isPending) {
        return (
            <div className="flex justify-center py-24">
                <Spinner />
            </div>
        );
    }

    if (recap.isError) {
        return (
            <div className="py-12 max-w-md mx-auto">
                <InfoBanner variant="error">
                    Couldn&apos;t load the recap for this run. Try again in a
                    moment.
                </InfoBanner>
            </div>
        );
    }

    if (recap.data === null) {
        return (
            <div className="py-12">
                <BackLink />
                <EmptyState
                    icon={Scale}
                    title="No recap yet"
                    description="This run hasn't frozen yet — its recap will appear here once play ends."
                />
            </div>
        );
    }

    const data = recap.data;
    const ownerNames = Object.fromEntries(
        data.rows.map((row) => [row.account_id, row.username_at_freeze]),
    );

    return (
        <div className="flex flex-col gap-10 py-8">
            <BackLink />

            <div className="flex flex-col gap-1">
                <TypographyH1 className="text-primary">
                    {data.name}
                </TypographyH1>
                <p className="text-foreground/80">
                    {formatTimestamp(data.starts_at)}
                    {data.ended_at
                        ? ` – ${formatTimestamp(data.ended_at)}`
                        : data.freeze_at
                          ? ` – ${formatTimestamp(data.freeze_at)}`
                          : ""}
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    icon={Users}
                    label="Players"
                    value={data.player_count.toLocaleString()}
                />
                <StatCard
                    icon={Factory}
                    label="CO₂ produced"
                    value={formatEmissions(data.total_produced_co2)}
                />
                {/* CO2 captured: dropped for now, may return later.
                <StatCard
                    icon={Leaf}
                    label="CO₂ captured"
                    value={formatEmissions(data.total_captured_co2)}
                />
                */}
                <StatCard
                    icon={Scale}
                    label="Net emissions"
                    value={formatEmissions(data.total_net_emissions)}
                />
            </div>

            <section className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                    <h2 className="text-lg font-semibold text-primary font-titles">
                        Players
                    </h2>
                    <p className="text-sm text-foreground/70">
                        Click a column to sort the table.
                    </p>
                </div>
                <Card>
                    <CardContent className="overflow-x-auto px-0">
                        <RecapTable rows={data.rows} />
                    </CardContent>
                </Card>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-primary font-titles">
                    The map
                </h2>
                <Card>
                    <CardContent>
                        <RecapMap tiles={data.tiles} ownerNames={ownerNames} />
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}

function BackLink() {
    return (
        <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors w-fit"
        >
            <ArrowLeft className="w-4 h-4" />
            Back to lobby
        </Link>
    );
}

function StatCard({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <Card className="py-4">
            <CardContent className="flex flex-row items-center gap-3">
                <Icon className="w-6 h-6 text-primary shrink-0" />
                <div className="flex flex-col min-w-0">
                    <TypographyMuted className="text-xs">
                        {label}
                    </TypographyMuted>
                    <p className="text-xl font-semibold tabular-nums truncate">
                        {value}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

// --- retrospective table ------------------------------------------------

type MeasureKey = "operating_income" | "produced_co2" | "captured_co2" | "xp";
type SortKey = MeasureKey | "username_at_freeze" | "network_name";
type SortDir = "asc" | "desc";

/** 0 = gold, 1 = silver, 2 = bronze. */
type Tier = 0 | 1 | 2;

type Column = {
    key: SortKey;
    label: string;
    /**
     * Every column is centred; this only switches the cell to tabular/mono
     * digits.
     */
    numeric: boolean;
    render: (row: RecapRow) => React.ReactNode;
    /**
     * Podium config for this column, or omitted for columns with no ranking
     * (Player, Network). `direction` picks which extreme takes gold — "desc"
     * for income/XP (highest first), "asc" for CO2 (lowest first). `medal`
     * additionally draws the medal icon — reserved for income, the recap's one
     * ranked metric; XP and CO2 get the tint only.
     */
    podium?: { direction: SortDir; medal?: boolean };
};

const COLUMNS: Column[] = [
    {
        key: "username_at_freeze",
        label: "Player",
        numeric: false,
        render: (row) => row.username_at_freeze,
    },
    {
        key: "network_name",
        label: "Network",
        numeric: false,
        render: (row) => row.network_name ?? "—",
    },
    {
        key: "operating_income",
        label: "Income",
        numeric: true,
        render: (row) => <Money amount={row.operating_income} />,
        podium: { direction: "desc", medal: true },
    },
    {
        key: "produced_co2",
        label: "CO₂ produced",
        numeric: true,
        render: (row) => formatEmissions(row.produced_co2),
        // Lower is better: the three cleanest players take gold, not the
        // three biggest emitters.
        podium: { direction: "asc" },
    },
    // CO2 captured: dropped for now, may return later.
    // {
    //     key: "captured_co2",
    //     label: "CO₂ captured",
    //     numeric: true,
    //     render: (row) => formatEmissions(row.captured_co2),
    //     podium: { direction: "desc" },
    // },
    {
        key: "xp",
        label: "XP",
        numeric: true,
        render: (row) => Math.round(row.xp).toLocaleString(),
        podium: { direction: "desc" },
    },
];

// First-click direction: numbers lead "best/most first" (desc), names A→Z.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
    username_at_freeze: "asc",
    network_name: "asc",
    operating_income: "desc",
    produced_co2: "desc",
    captured_co2: "desc",
    xp: "desc",
};

function compare(a: RecapRow, b: RecapRow, key: SortKey): number {
    const av = a[key];
    const bv = b[key];
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv));
    }
    return av - bv;
}

// Faint gold/silver/bronze cell tints, paired with the medal emoji below by
// index. Kept separate (rather than derived) so the tint always pairs with
// its metal — tweak one without hunting for the other.
const TIER_CELL_BG: Record<Tier, string> = {
    // Gold runs more saturated than silver/bronze: amber sits close in hue to
    // this page's warm tan surface, so a tint as faint as the other two all
    // but vanishes on it — bumped until it reads at a glance.
    0: "bg-amber-500/35 dark:bg-amber-400/20",
    1: "bg-slate-400/25 dark:bg-slate-300/15",
    2: "bg-orange-700/20 dark:bg-orange-500/15",
};
const TIER_MEDAL_EMOJI: Record<Tier, string> = {
    0: "\u{1F947}", // 🥇
    1: "\u{1F948}", // 🥈
    2: "\u{1F949}", // 🥉
};
const TIER_LABEL: Record<Tier, string> = {
    0: "Gold",
    1: "Silver",
    2: "Bronze",
};

/**
 * Account_id → tier for one podium column, ranked independently of the other
 * columns (and of the table's current sort/display order) so a player can
 * podium in income without podiuming in XP or CO2.
 */
function computePodium(
    rows: RecapRow[],
    key: MeasureKey,
    direction: SortDir,
): Map<number, Tier> {
    const dirMul = direction === "desc" ? -1 : 1;
    const podium = new Map<number, Tier>();
    [...rows]
        .sort((a, b) => dirMul * (a[key] - b[key]))
        .slice(0, 3)
        .forEach((row, i) => podium.set(row.account_id, i as Tier));
    return podium;
}

function RecapTable({ rows }: { rows: RecapRow[] }) {
    const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
        key: "operating_income",
        dir: "desc",
    });

    // One podium per opted-in column (income, CO2 produced, XP).
    const podiums = useMemo(() => {
        const out = new Map<SortKey, Map<number, Tier>>();
        for (const col of COLUMNS) {
            if (col.podium) {
                out.set(
                    col.key,
                    computePodium(
                        rows,
                        col.key as MeasureKey,
                        col.podium.direction,
                    ),
                );
            }
        }
        return out;
    }, [rows]);
    const sorted = useMemo(() => {
        const withDir = sort.dir === "asc" ? 1 : -1;
        return [...rows].sort((a, b) => withDir * compare(a, b, sort.key));
    }, [rows, sort]);

    const toggleSort = (key: SortKey) => {
        setSort((prev) =>
            prev.key === key
                ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
                : { key, dir: DEFAULT_DIR[key] },
        );
    };

    if (rows.length === 0) {
        return (
            <EmptyState
                icon={Factory}
                title="No players"
                description="Nobody settled in this run before it froze."
            />
        );
    }

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="bg-surface-sunken">
                    {COLUMNS.map((col) => (
                        <th
                            key={col.key}
                            className="py-3 px-4 font-semibold whitespace-nowrap text-center"
                        >
                            <button
                                onClick={() => toggleSort(col.key)}
                                className={cn(
                                    "inline-flex items-center justify-center gap-1 hover:text-primary transition-colors",
                                    sort.key === col.key && "text-primary",
                                )}
                            >
                                {col.label}
                                <SortIcon
                                    active={sort.key === col.key}
                                    dir={sort.dir}
                                />
                            </button>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {sorted.map((row) => (
                    <tr
                        key={row.account_id}
                        className="border-b border-gray-200 dark:border-gray-700 transition-colors hover:bg-tan-green/20 dark:hover:bg-muted/30"
                    >
                        {COLUMNS.map((col) => {
                            const tier = podiums
                                .get(col.key)
                                ?.get(row.account_id);
                            return (
                                <td
                                    key={col.key}
                                    className={cn(
                                        "py-3 px-4 whitespace-nowrap text-center",
                                        col.numeric && "font-mono",
                                        col.key === "username_at_freeze" &&
                                            "font-medium",
                                        col.key === "network_name" &&
                                            "text-muted-foreground",
                                        // Podium tint lives on the cell box, not an
                                        // inner span, so it can't nudge the number off
                                        // centre.
                                        tier !== undefined && [
                                            TIER_CELL_BG[tier],
                                            "font-semibold text-foreground",
                                        ],
                                    )}
                                >
                                    {col.podium?.medal && tier !== undefined ? (
                                        <span className="inline-flex w-full items-center justify-center gap-1.5">
                                            <span
                                                className="shrink-0"
                                                role="img"
                                                aria-label={`${TIER_LABEL[tier]} medal`}
                                            >
                                                {TIER_MEDAL_EMOJI[tier]}
                                            </span>
                                            <span
                                                title={`${TIER_LABEL[tier]} — top 3 by income`}
                                            >
                                                {col.render(row)}
                                            </span>
                                        </span>
                                    ) : (
                                        col.render(row)
                                    )}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return dir === "asc" ? (
        <ArrowUp className="w-3.5 h-3.5" />
    ) : (
        <ArrowDown className="w-3.5 h-3.5" />
    );
}
