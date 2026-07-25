/**
 * THROWAWAY PROTOTYPE — variant C "Atlas", issue #864 (T6).
 *
 * Map-as-hero: the world you played in is the centrepiece, the retrospective
 * table rides alongside it. Hovering a settled tile highlights that player's
 * row and vice-versa — the map and the record are one artifact. Foregrounds
 * territory/geography over the numbers.
 */

import { useMemo, useState } from "react";

import { TypographyH2, TypographyMuted } from "@/components/ui/typography";

import { MEASURES, Recap, topThree } from "./mock";
import { RecapMap } from "./recap-map";

export function VariantC({ recap }: { recap: Recap }) {
    const [active, setActive] = useState<number | null>(null);
    const ownerNames = useMemo(
        () =>
            Object.fromEntries(
                recap.rows.map((r) => [r.account_id, r.username_at_freeze]),
            ),
        [recap.rows],
    );
    const incomeTop = useMemo(
        () => topThree(recap.rows, "operating_income"),
        [recap.rows],
    );
    const rows = useMemo(
        () =>
            [...recap.rows].sort(
                (a, b) => b.operating_income - a.operating_income,
            ),
        [recap.rows],
    );

    return (
        <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
                <TypographyH2>{recap.name}</TypographyH2>
                <TypographyMuted>
                    1 Jun – 15 Jul 2026 · {recap.player_count} players ·{" "}
                    {Math.round(recap.total_produced_co2 / 1000)} t produced /{" "}
                    {Math.round(recap.total_captured_co2 / 1000)} t captured
                </TypographyMuted>
            </div>

            <div className="mt-6 grid gap-8 lg:grid-cols-[3fr_2fr]">
                <div>
                    <RecapMap
                        tiles={recap.tiles}
                        ownerNames={ownerNames}
                        highlightAccountId={active}
                        onHoverOwner={setActive}
                    />
                </div>
                <div>
                    <p className="mb-3 text-sm text-muted-foreground">
                        How the run unfolded — hover a name or a settled tile.
                    </p>
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                <th className="py-1.5 font-medium">Player</th>
                                <th className="py-1.5 text-right font-medium">
                                    Income
                                </th>
                                <th className="py-1.5 text-right font-medium">
                                    Produced
                                </th>
                                <th className="py-1.5 text-right font-medium">
                                    Captured
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.account_id}
                                    onMouseEnter={() =>
                                        setActive(row.account_id)
                                    }
                                    onMouseLeave={() => setActive(null)}
                                    className={`border-b border-border/50 transition-colors ${
                                        active === row.account_id
                                            ? "bg-foreground/5"
                                            : ""
                                    }`}
                                >
                                    <td className="py-2">
                                        <span
                                            className={
                                                incomeTop.has(row.account_id)
                                                    ? "font-semibold"
                                                    : ""
                                            }
                                        >
                                            {row.username_at_freeze}
                                        </span>
                                        {row.network_name && (
                                            <span className="ml-1.5 text-xs text-muted-foreground">
                                                {row.network_name}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2 text-right tabular-nums">
                                        {MEASURES[0]!.format(
                                            row.operating_income,
                                        )}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                                        {MEASURES[2]!.format(row.produced_co2)}
                                    </td>
                                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                                        {MEASURES[1]!.format(row.captured_co2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
