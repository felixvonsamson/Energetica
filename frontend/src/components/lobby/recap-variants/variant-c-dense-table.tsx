/**
 * PROTOTYPE variant — see prototype-switcher.tsx. Delete with the rest of
 * recap-variants/.
 */

import { Trophy } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import {
    formatEmissions,
    formatMoney,
    formatTimestamp,
} from "@/lib/format-utils";
import type { Recap } from "@/lib/recap";

/**
 * Minimal chrome, maximal data: one dense analytical table with an inline
 * income bar per row (proportional to the top score) instead of separate stat
 * tiles or a podium. Aimed at players who want to scan the whole field at a
 * glance rather than be told a headline story.
 */
export function VariantCDenseTable({ data }: { data: Recap }) {
    const maxIncome = Math.max(1, ...data.rows.map((r) => r.operating_income));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-row flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border pb-3">
                <h1 className="text-xl font-bold font-titles">{data.name}</h1>
                <div className="flex flex-row flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground font-mono">
                    <span>
                        {formatTimestamp(data.starts_at)}
                        {data.ended_at
                            ? ` – ${formatTimestamp(data.ended_at)}`
                            : data.freeze_at
                              ? ` – ${formatTimestamp(data.freeze_at)}`
                              : ""}
                    </span>
                    <span>{data.player_count} players</span>
                    <span>
                        {formatEmissions(data.total_captured_co2)} captured
                    </span>
                    <span>{formatEmissions(data.total_net_emissions)} net</span>
                </div>
            </div>

            {data.rows.length === 0 ? (
                <EmptyState
                    icon={Trophy}
                    title="No players"
                    description="Nobody settled in this run before it froze."
                />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                                <th className="py-1.5 pr-3 font-medium">#</th>
                                <th className="py-1.5 pr-3 font-medium">
                                    Player
                                </th>
                                <th className="py-1.5 pr-3 font-medium">
                                    Network
                                </th>
                                <th className="py-1.5 pr-3 font-medium">
                                    Income
                                </th>
                                <th className="py-1.5 pr-3 font-medium text-right">
                                    XP
                                </th>
                                <th className="py-1.5 font-medium text-right">
                                    CO2
                                </th>
                            </tr>
                        </thead>
                        <tbody className="font-mono text-[13px]">
                            {data.rows.map((row) => (
                                <tr
                                    key={row.account_id}
                                    className="border-t border-border/60 hover:bg-muted/50"
                                >
                                    <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">
                                        {row.rank}
                                    </td>
                                    <td className="py-1.5 pr-3 font-sans font-medium">
                                        {row.username_at_freeze}
                                    </td>
                                    <td className="py-1.5 pr-3 text-muted-foreground">
                                        {row.network_name ?? "—"}
                                    </td>
                                    <td className="py-1.5 pr-3 w-1/3">
                                        <div className="flex flex-row items-center gap-2">
                                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                                <div
                                                    className="h-full bg-primary rounded-full"
                                                    style={{
                                                        width: `${(row.operating_income / maxIncome) * 100}%`,
                                                    }}
                                                />
                                            </div>
                                            <span className="tabular-nums w-16 text-right shrink-0">
                                                {formatMoney(
                                                    row.operating_income,
                                                )}
                                                $
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums">
                                        {Math.round(row.xp).toLocaleString()}
                                    </td>
                                    <td className="py-1.5 text-right tabular-nums">
                                        {formatEmissions(row.captured_co2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
