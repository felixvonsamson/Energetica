/**
 * THROWAWAY PROTOTYPE — variant B "Facets", issue #864 (T6).
 *
 * The anti-scoreboard thesis made structural: no monolithic table as hero.
 * Instead, one panel per measure ("Most consequential", "Deepest decarboniser",
 * …), each a small top-3 list — so the page reads as "many ways to have
 * mattered" rather than one ranking. The full roster is a quiet, collapsible
 * table below.
 */

import { useMemo, useState } from "react";

import { TypographyH2, TypographyMuted } from "@/components/ui/typography";

import { MEASURES, Measure, Recap } from "./mock";
import { RecapMap } from "./recap-map";

function FacetPanel({ measure, recap }: { measure: Measure; recap: Recap }) {
    const top = useMemo(
        () =>
            [...recap.rows]
                .sort((a, b) => b[measure.key] - a[measure.key])
                .slice(0, 3),
        [recap.rows, measure.key],
    );
    return (
        <div className="rounded-lg border border-border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {measure.gloss}
            </div>
            <div className="mb-3 text-sm text-muted-foreground/70">
                by {measure.label.toLowerCase()}
            </div>
            <ol className="space-y-2">
                {top.map((row, i) => (
                    <li
                        key={row.account_id}
                        className="flex items-baseline justify-between gap-3"
                    >
                        <span
                            className={
                                i === 0 ? "font-semibold" : "text-foreground"
                            }
                        >
                            {row.username_at_freeze}
                        </span>
                        <span className="tabular-nums text-sm text-muted-foreground">
                            {measure.format(row[measure.key])}
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

export function VariantB({ recap }: { recap: Recap }) {
    const [showAll, setShowAll] = useState(false);
    const ownerNames = useMemo(
        () =>
            Object.fromEntries(
                recap.rows.map((r) => [r.account_id, r.username_at_freeze]),
            ),
        [recap.rows],
    );
    const roster = useMemo(
        () =>
            [...recap.rows].sort(
                (a, b) => b.operating_income - a.operating_income,
            ),
        [recap.rows],
    );

    return (
        <div className="mx-auto max-w-5xl px-4 py-10">
            <TypographyMuted>Recap · frozen at freeze</TypographyMuted>
            <TypographyH2 className="mt-1">{recap.name}</TypographyH2>
            <TypographyMuted className="mt-1">
                1 Jun – 15 Jul 2026 · {recap.player_count} players ·{" "}
                {Math.round(recap.total_produced_co2 / 1000)} t produced,{" "}
                {Math.round(recap.total_captured_co2 / 1000)} t captured
            </TypographyMuted>

            <p className="mt-8 text-sm text-muted-foreground">
                Four ways this run mattered — no overall winner, just who led
                each measure.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {MEASURES.map((m) => (
                    <FacetPanel key={m.key} measure={m} recap={recap} />
                ))}
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-[3fr_2fr]">
                <div>
                    <button
                        onClick={() => setShowAll((s) => !s)}
                        className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
                    >
                        {showAll ? "Hide" : "Show"} all {recap.player_count}{" "}
                        players
                    </button>
                    {showAll && (
                        <table className="mt-3 w-full border-collapse text-sm">
                            <tbody>
                                {roster.map((row) => (
                                    <tr
                                        key={row.account_id}
                                        className="border-b border-border/50"
                                    >
                                        <td className="py-2">
                                            {row.username_at_freeze}
                                            {row.network_name && (
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    {row.network_name}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                                            $
                                            {Math.round(
                                                row.operating_income,
                                            ).toLocaleString("en-US")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div>
                    <TypographyMuted>The world you played in</TypographyMuted>
                    <RecapMap
                        tiles={recap.tiles}
                        ownerNames={ownerNames}
                        className="mt-3"
                    />
                </div>
            </div>
        </div>
    );
}
