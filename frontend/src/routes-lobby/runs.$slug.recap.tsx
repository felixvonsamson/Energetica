/**
 * The v1 baseline recap page — renders a run's published recap (the frozen
 * leaderboard tombstone minted at `active → freeze`, G1/T5) once it exists.
 *
 * Deliberately baseline, not the full spec: identity header, income-ranked
 * leaderboard, totals footer. No map/tile snapshot — the minted recap payload
 * (`energetica/schemas/recap.py`) carries no tile data, so that's deferred to a
 * future amendment rather than guessed at here (see #864 discussion).
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Award, Leaf, Trophy, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoBanner } from "@/components/ui/info-banner";
import { Money } from "@/components/ui/money";
import { Spinner } from "@/components/ui/spinner";
import { TypographyH1, TypographyMuted } from "@/components/ui/typography";
import { useRecap } from "@/hooks/use-lobby";
import { formatEmissions, formatTimestamp } from "@/lib/format-utils";
import type { RecapRow } from "@/lib/recap";

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

function LeaderboardTable({ rows }: { rows: RecapRow[] }) {
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
                        <th className="py-2 pr-4 font-medium">Rank</th>
                        <th className="py-2 pr-4 font-medium">Player</th>
                        <th className="py-2 pr-4 font-medium">Network</th>
                        <th className="py-2 pr-4 font-medium text-right">
                            Income
                        </th>
                        <th className="py-2 pr-4 font-medium text-right">XP</th>
                        <th className="py-2 font-medium text-right">
                            CO2 captured
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr
                            key={row.account_id}
                            className="border-b border-border last:border-0"
                        >
                            <td className="py-2 pr-4">
                                <span className="inline-flex items-center gap-1">
                                    {row.rank <= 3 && (
                                        <Award
                                            className={
                                                row.rank === 1
                                                    ? "w-4 h-4 text-yellow-500"
                                                    : row.rank === 2
                                                      ? "w-4 h-4 text-gray-400"
                                                      : "w-4 h-4 text-amber-700"
                                            }
                                        />
                                    )}
                                    {row.rank}
                                </span>
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
