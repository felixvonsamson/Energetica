/**
 * PROTOTYPE variant — see prototype-switcher.tsx. Delete with the rest of
 * recap-variants/.
 */

import { Leaf, Trophy, Users } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/money";
import { TypographyMuted } from "@/components/ui/typography";
import { formatEmissions, formatTimestamp } from "@/lib/format-utils";
import type { Recap, RecapRow } from "@/lib/recap";
import { cn } from "@/lib/utils";

/**
 * Awards-ceremony framing: a podium spotlight for the top 3, everyone else as a
 * compact ranked list. Totals live as a slim strip up top rather than card
 * tiles. Structurally the most different of the three — no table for the
 * headline result.
 */
export function VariantBPodium({ data }: { data: Recap }) {
    const podium = data.rows.slice(0, 3);
    const rest = data.rows.slice(3);
    // Podium display order: 2nd, 1st, 3rd (classic ceremony layout).
    const podiumOrder = [podium[1], podium[0], podium[2]].filter(
        (row): row is RecapRow => row !== undefined,
    );

    return (
        <div className="flex flex-col gap-10">
            <div className="text-center flex flex-col items-center gap-2">
                <p className="text-sm uppercase tracking-widest text-muted-foreground font-mono">
                    Final recap
                </p>
                <h1 className="text-3xl font-bold font-titles">{data.name}</h1>
                <TypographyMuted>
                    {formatTimestamp(data.starts_at)}
                    {data.ended_at
                        ? ` – ${formatTimestamp(data.ended_at)}`
                        : data.freeze_at
                          ? ` – ${formatTimestamp(data.freeze_at)}`
                          : ""}
                </TypographyMuted>
                <div className="flex flex-row gap-6 mt-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        {data.player_count} players
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <Leaf className="w-4 h-4" />
                        {formatEmissions(data.total_captured_co2)} captured
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <Leaf className="w-4 h-4" />
                        {formatEmissions(data.total_net_emissions)} net
                    </span>
                </div>
            </div>

            {podium.length === 0 ? (
                <EmptyState
                    icon={Trophy}
                    title="No players"
                    description="Nobody settled in this run before it froze."
                />
            ) : (
                <div className="flex flex-row items-end justify-center gap-3 sm:gap-6">
                    {podiumOrder.map((row) => (
                        <PodiumBlock key={row.account_id} row={row} />
                    ))}
                </div>
            )}

            {rest.length > 0 && (
                <div className="flex flex-col gap-1 max-w-2xl mx-auto w-full">
                    {rest.map((row) => (
                        <div
                            key={row.account_id}
                            className="flex flex-row items-center gap-4 px-4 py-2.5 rounded-xl hover:bg-muted transition-colors"
                        >
                            <span className="w-6 text-muted-foreground font-mono text-sm tabular-nums">
                                {row.rank}
                            </span>
                            <span className="flex-1 font-medium truncate">
                                {row.username_at_freeze}
                            </span>
                            {row.network_name && (
                                <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                                    {row.network_name}
                                </span>
                            )}
                            <Money amount={row.operating_income} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

type PodiumStyle = { height: string; bg: string; medal: string };

function podiumStyle(rank: number): PodiumStyle {
    switch (rank) {
        case 1:
            return {
                height: "h-40 sm:h-52",
                bg: "bg-yellow-400/15 border-yellow-400",
                medal: "🥇",
            };
        case 2:
            return {
                height: "h-32 sm:h-40",
                bg: "bg-gray-300/15 border-gray-400",
                medal: "🥈",
            };
        default:
            return {
                height: "h-24 sm:h-32",
                bg: "bg-amber-700/15 border-amber-700",
                medal: "🥉",
            };
    }
}

function PodiumBlock({ row }: { row: RecapRow }) {
    const style = podiumStyle(row.rank);
    return (
        <div className="flex flex-col items-center gap-2 w-28 sm:w-36">
            <span className="text-2xl">{style.medal}</span>
            <p className="font-semibold text-center truncate w-full">
                {row.username_at_freeze}
            </p>
            {row.network_name && (
                <TypographyMuted className="text-xs">
                    {row.network_name}
                </TypographyMuted>
            )}
            <div
                className={cn(
                    "w-full rounded-t-2xl border-2 border-b-0 flex flex-col items-center justify-start pt-3 gap-1",
                    style.height,
                    style.bg,
                )}
            >
                <Money amount={row.operating_income} className="text-lg" />
                <TypographyMuted className="text-xs">
                    {Math.round(row.xp).toLocaleString()} XP
                </TypographyMuted>
            </div>
        </div>
    );
}
