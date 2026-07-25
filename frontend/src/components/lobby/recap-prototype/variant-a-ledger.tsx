/**
 * THROWAWAY PROTOTYPE — variant A "Ledger", issue #864 (T6).
 *
 * Table-as-hero. One wide retrospective table, every column sortable, income
 * order by default. No rank/position column — the anti-scoreboard. Per-column
 * top-3 cells get a subtle marker so different people light up in different
 * columns. Map is a quiet strip at the foot.
 */

import { useMemo, useState } from "react";

import { TypographyH2, TypographyMuted } from "@/components/ui/typography";

import { MEASURES, Measure, Recap, topThree } from "./mock";
import { RecapMap } from "./recap-map";

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-2xl font-semibold tabular-nums">{value}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {label}
            </div>
        </div>
    );
}

export function VariantA({ recap }: { recap: Recap }) {
    const [sortKey, setSortKey] = useState<Measure["key"]>("operating_income");
    const ownerNames = useMemo(
        () =>
            Object.fromEntries(
                recap.rows.map((r) => [r.account_id, r.username_at_freeze]),
            ),
        [recap.rows],
    );

    const tops = useMemo(
        () =>
            Object.fromEntries(
                MEASURES.map((m) => [m.key, topThree(recap.rows, m.key)]),
            ) as Record<Measure["key"], Map<number, number>>,
        [recap.rows],
    );

    const rows = useMemo(
        () => [...recap.rows].sort((a, b) => b[sortKey] - a[sortKey]),
        [recap.rows, sortKey],
    );

    return (
        <div className="mx-auto max-w-5xl px-4 py-10">
            <TypographyMuted>Recap · frozen at freeze</TypographyMuted>
            <TypographyH2 className="mt-1">{recap.name}</TypographyH2>
            <TypographyMuted className="mt-1">
                1 Jun – 15 Jul 2026 · {recap.player_count} players
            </TypographyMuted>

            <div className="mt-6 flex flex-wrap gap-x-12 gap-y-4 border-y border-border py-5">
                <Stat
                    label="CO₂ produced"
                    value={`${Math.round(recap.total_produced_co2 / 1000)} t`}
                />
                <Stat
                    label="CO₂ captured"
                    value={`${Math.round(recap.total_captured_co2 / 1000)} t`}
                />
                <Stat
                    label="Net emissions"
                    value={`${Math.round(recap.total_net_emissions / 1000)} t`}
                />
            </div>

            <p className="mt-8 text-sm text-muted-foreground">
                How the run unfolded. Sort by any measure — there was no single
                winner; the highlighted cells are the top three in each column.
            </p>

            <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                    <tr className="border-b border-border text-left">
                        <th className="py-2 pr-4 font-medium">Player</th>
                        {MEASURES.map((m) => (
                            <th
                                key={m.key}
                                className="py-2 pl-4 text-right font-medium"
                            >
                                <button
                                    onClick={() => setSortKey(m.key)}
                                    className={`hover:text-foreground ${
                                        sortKey === m.key
                                            ? "text-foreground underline decoration-dotted underline-offset-4"
                                            : "text-muted-foreground"
                                    }`}
                                >
                                    {m.label}
                                </button>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr
                            key={row.account_id}
                            className="border-b border-border/50"
                        >
                            <td className="py-2.5 pr-4">
                                <div className="font-medium">
                                    {row.username_at_freeze}
                                </div>
                                {row.network_name && (
                                    <div className="text-xs text-muted-foreground">
                                        {row.network_name}
                                    </div>
                                )}
                            </td>
                            {MEASURES.map((m) => {
                                const place = tops[m.key].get(row.account_id);
                                return (
                                    <td
                                        key={m.key}
                                        className="py-2.5 pl-4 text-right tabular-nums"
                                    >
                                        <span
                                            className={
                                                place
                                                    ? "rounded bg-foreground/10 px-1.5 py-0.5 font-medium"
                                                    : ""
                                            }
                                        >
                                            {m.format(row[m.key])}
                                        </span>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="mt-12">
                <TypographyMuted>The world you played in</TypographyMuted>
                <RecapMap
                    tiles={recap.tiles}
                    ownerNames={ownerNames}
                    className="mt-3"
                />
            </div>
        </div>
    );
}
