/**
 * The v1 baseline recap page — renders a run's published recap (the frozen
 * leaderboard tombstone minted at `active → freeze`, G1/T5) once it exists.
 *
 * Deliberately baseline, not the full spec: identity header, income-ranked
 * leaderboard, totals footer. No map/tile snapshot — the minted recap payload
 * (`energetica/schemas/recap.py`) carries no tile data, so that's deferred to a
 * future amendment rather than guessed at here (see #864 discussion).
 *
 * The layout was settled via a `/prototype` UI exploration (three variants —
 * cards+table, podium spotlight, dense table); this one won. The full set of
 * variants is preserved on the `prototype/864-recap-variants` branch.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    ArrowUpDown,
    Leaf,
    Trophy,
    Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
                    icon={Trophy}
                    title="No recap yet"
                    description="This run hasn't frozen yet — its recap will appear here once play ends."
                />
            </div>
        );
    }

    const data = recap.data;
    return (
        <div className="flex flex-col gap-8 py-8">
            <BackLink />

            <div className="flex flex-col gap-1">
                <TypographyH1>{data.name}</TypographyH1>
                <TypographyMuted>
                    {formatTimestamp(data.starts_at)}
                    {data.ended_at
                        ? ` – ${formatTimestamp(data.ended_at)}`
                        : data.freeze_at
                          ? ` – ${formatTimestamp(data.freeze_at)}`
                          : ""}
                </TypographyMuted>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    icon={Users}
                    label="Players"
                    value={data.player_count.toString()}
                />
                <StatCard
                    icon={Leaf}
                    label="Total CO2 captured"
                    value={formatEmissions(data.total_captured_co2)}
                />
                <StatCard
                    icon={Leaf}
                    label="Total net emissions"
                    value={formatEmissions(data.total_net_emissions)}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-primary" />
                        Final leaderboard
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <LeaderboardTable rows={data.rows} />
                </CardContent>
            </Card>
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
                <Icon className="w-5 h-5 text-primary shrink-0" />
                <div className="flex flex-col min-w-0">
                    <TypographyMuted className="text-xs">
                        {label}
                    </TypographyMuted>
                    <p className="text-lg font-semibold truncate">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

type SortKey =
    | "rank"
    | "username_at_freeze"
    | "network_name"
    | "operating_income"
    | "xp"
    | "captured_co2";
type SortDir = "asc" | "desc";

// The direction a column starts at on first click — numeric columns lead with
// their "best first" direction (rank ascending, everything else descending),
// text columns lead A→Z.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
    rank: "asc",
    username_at_freeze: "asc",
    network_name: "asc",
    operating_income: "desc",
    xp: "desc",
    captured_co2: "desc",
};

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "rank", label: "Rank", align: "left" },
    { key: "username_at_freeze", label: "Player", align: "left" },
    { key: "network_name", label: "Network", align: "left" },
    { key: "operating_income", label: "Income", align: "right" },
    { key: "xp", label: "XP", align: "right" },
    { key: "captured_co2", label: "CO2 captured", align: "right" },
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

function LeaderboardTable({ rows }: { rows: RecapRow[] }) {
    const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
        key: "rank",
        dir: "asc",
    });

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
                icon={Users}
                title="No players"
                description="Nobody settled in this run before it froze."
            />
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                        {COLUMNS.map((col) => (
                            <th key={col.key} className="py-2 pr-4 font-medium">
                                <button
                                    onClick={() => toggleSort(col.key)}
                                    className={cn(
                                        "inline-flex items-center gap-1 hover:text-foreground transition-colors",
                                        col.align === "right" &&
                                            "flex-row-reverse",
                                        sort.key === col.key &&
                                            "text-foreground",
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
                            className="border-b border-border last:border-0"
                        >
                            <td className="py-2 pr-4 tabular-nums">
                                {row.rank}
                            </td>
                            <td className="py-2 pr-4 font-medium">
                                {row.username_at_freeze}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">
                                {row.network_name ?? "—"}
                            </td>
                            <td className="py-2 pr-4 text-right">
                                <Money amount={row.operating_income} />
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums">
                                {Math.round(row.xp).toLocaleString()}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                                {formatEmissions(row.captured_co2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
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
