/**
 * The v1 baseline recap page — renders a run's published recap (the frozen
 * tombstone minted at `active → freeze`, T5/G1) on the lobby, once it exists.
 *
 * A retrospective, not a scoreboard (ADR-0005 / G3): no winner, no rank. CO2 is
 * laid bare, un-netted (captured is dropped from view for now, see below). Rows
 * carry no position; the per-player table defaults to operating-income order
 * ("most consequential first") but every column is sortable, and the top three
 * in each column get a single, uniform emphasis — deliberately not a 1/2/3
 * podium.
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
                    {" · "}
                    {data.player_count} player
                    {data.player_count === 1 ? "" : "s"}
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

type Column = {
    key: SortKey;
    label: string;
    align: "left" | "right";
    /** Measure columns are numeric, right-aligned, and get top-3 emphasis. */
    measure: boolean;
    render: (row: RecapRow) => React.ReactNode;
};

const COLUMNS: Column[] = [
    {
        key: "username_at_freeze",
        label: "Player",
        align: "left",
        measure: false,
        render: (row) => row.username_at_freeze,
    },
    {
        key: "network_name",
        label: "Network",
        align: "left",
        measure: false,
        render: (row) => row.network_name ?? "—",
    },
    {
        key: "operating_income",
        label: "Income",
        align: "right",
        measure: true,
        render: (row) => <Money amount={row.operating_income} />,
    },
    {
        key: "produced_co2",
        label: "CO₂ produced",
        align: "right",
        measure: true,
        render: (row) => formatEmissions(row.produced_co2),
    },
    // CO2 captured: dropped for now, may return later.
    // {
    //     key: "captured_co2",
    //     label: "CO₂ captured",
    //     align: "right",
    //     measure: true,
    //     render: (row) => formatEmissions(row.captured_co2),
    // },
    {
        key: "xp",
        label: "XP",
        align: "right",
        measure: true,
        render: (row) => Math.round(row.xp).toLocaleString(),
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

const MEASURE_KEYS: MeasureKey[] = [
    "operating_income",
    "produced_co2",
    // "captured_co2", — dropped for now, may return later (see COLUMNS above).
    "xp",
];

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

/** Account_ids in the top three by each measure — the (uniform) emphasis set. */
function topThreeByMeasure(rows: RecapRow[]): Record<MeasureKey, Set<number>> {
    const out = {} as Record<MeasureKey, Set<number>>;
    for (const key of MEASURE_KEYS) {
        const ranked = [...rows]
            .sort((a, b) => b[key] - a[key])
            .slice(0, 3)
            .map((row) => row.account_id);
        out[key] = new Set(ranked);
    }
    return out;
}

function RecapTable({ rows }: { rows: RecapRow[] }) {
    const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
        key: "operating_income",
        dir: "desc",
    });

    const tops = useMemo(() => topThreeByMeasure(rows), [rows]);
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
                <tr className="bg-secondary text-left">
                    {COLUMNS.map((col) => (
                        <th
                            key={col.key}
                            className={cn(
                                "py-3 px-4 font-semibold whitespace-nowrap",
                                col.align === "right"
                                    ? "text-right"
                                    : "text-left",
                            )}
                        >
                            <button
                                onClick={() => toggleSort(col.key)}
                                className={cn(
                                    "inline-flex items-center gap-1 hover:text-primary transition-colors",
                                    col.align === "right" && "flex-row-reverse",
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
                            const emphasised =
                                col.measure &&
                                tops[col.key as MeasureKey].has(row.account_id);
                            return (
                                <td
                                    key={col.key}
                                    className={cn(
                                        "py-3 px-4 whitespace-nowrap",
                                        col.align === "right"
                                            ? "text-right font-mono"
                                            : "text-left",
                                        col.key === "username_at_freeze" &&
                                            "font-medium",
                                        col.key === "network_name" &&
                                            "text-muted-foreground",
                                        // Top-3 emphasis lives on the cell box, not an
                                        // inner span, so it can't nudge the number off
                                        // the column's right edge.
                                        emphasised &&
                                            "bg-primary/10 font-semibold text-foreground",
                                    )}
                                >
                                    {col.render(row)}
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
