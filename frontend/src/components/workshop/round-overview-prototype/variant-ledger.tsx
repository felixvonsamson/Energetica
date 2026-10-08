/**
 * PROTOTYPE (#1008) — throwaway. Variant A, "Ledger": one classic income
 * statement, line items down the side and a column per season plus the Round
 * total. The detailed view switch inserts indented breakdown rows under each
 * line. Investments and net profit only exist in the Round column.
 */

import { Fragment, type ReactNode, useState } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TypographyH2 } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { SEASON_LABELS } from "@/lib/workshop-timeline";

import {
    CARBON_TAX_PER_TONNE,
    DUMP_PRICE,
    REVENUE_TAX_RATE,
    SEASONS,
    type SeasonFigures,
    investmentTotal,
    omTotal,
    omVariable,
    roundClosed,
    roundFigures,
    seasonSheet,
} from "./data";
import {
    Amount,
    BlackoutMark,
    Dash,
    PerMwh,
    SkippedCell,
    type VariantProps,
    mwh,
    pct,
    tonnes,
} from "./shared";

type Kind = "line" | "detail" | "subdetail" | "subtotal" | "total";

interface Row {
    label: ReactNode;
    kind: Kind;
    /** What to show for a column's figures. Unset for a Round-only row. */
    cell?: (f: SeasonFigures) => ReactNode;
    /** Shown in the Round column only. */
    round?: ReactNode;
    future?: boolean;
}

export function LedgerVariant({ round, futureRows }: VariantProps) {
    const [detailed, setDetailed] = useState(false);
    const total = roundFigures(round);
    const invest = investmentTotal(round);
    const operating = total
        ? seasonSheet(total, futureRows).operatingIncome
        : 0;
    const carbon = total ? seasonSheet(total, futureRows).carbonTax : 0;

    const rows: Row[] = [
        {
            label: "Market income",
            kind: "line",
            cell: (f) => (
                <Amount value={seasonSheet(f, futureRows).marketIncome} />
            ),
        },
        ...(detailed
            ? ([
                  {
                      label: "Energy sold",
                      kind: "detail",
                      cell: (f) => mwh(f.exportVolume),
                  },
                  {
                      label: "× average sell price",
                      kind: "detail",
                      cell: (f) => <PerMwh price={f.exportPrice} />,
                  },
                  {
                      label: "= Export revenue",
                      kind: "detail",
                      cell: (f) => (
                          <Amount
                              value={seasonSheet(f, futureRows).exportRevenue}
                          />
                      ),
                  },
                  {
                      label: "Energy bought (storage)",
                      kind: "detail",
                      cell: (f) => mwh(f.importVolume),
                  },
                  {
                      label: "× average buy price",
                      kind: "detail",
                      cell: (f) => <PerMwh price={f.importPrice} />,
                  },
                  {
                      label: "= Import cost",
                      kind: "detail",
                      cell: (f) => (
                          <Amount
                              value={seasonSheet(f, futureRows).importCost}
                              cost
                          />
                      ),
                  },
              ] satisfies Row[])
            : []),
        {
            label: "Dumping cost",
            kind: "line",
            cell: (f) => (
                <Amount value={seasonSheet(f, futureRows).dumpCost} cost />
            ),
        },
        ...(detailed
            ? ([
                  {
                      label: "Energy dumped",
                      kind: "detail",
                      cell: (f) => mwh(f.dumpVolume),
                  },
                  {
                      label: "× dump price",
                      kind: "detail",
                      cell: () => <PerMwh price={DUMP_PRICE} />,
                  },
              ] satisfies Row[])
            : []),
        {
            label: "O&M",
            kind: "line",
            cell: (f) => <Amount value={seasonSheet(f, futureRows).om} cost />,
        },
        ...(detailed
            ? (total?.om ?? []).flatMap((line, i): Row[] => [
                  {
                      label: `${line.facility} ×${line.count}`,
                      kind: "detail",
                      cell: (f) => <Amount value={omTotal(f.om[i]!)} cost />,
                  },
                  ...(line.variableFull > 0
                      ? ([
                            {
                                label: "Fixed",
                                kind: "subdetail",
                                cell: (f) => (
                                    <Amount value={f.om[i]!.fixed} cost />
                                ),
                            },
                            {
                                label: "Variable: usage × full amount",
                                kind: "subdetail",
                                cell: (f) => (
                                    <span className="text-xs">
                                        {pct(f.om[i]!.usage)} ×{" "}
                                        <Amount value={f.om[i]!.variableFull} />{" "}
                                        ={" "}
                                        <Amount
                                            value={omVariable(f.om[i]!)}
                                            cost
                                        />
                                    </span>
                                ),
                            },
                        ] satisfies Row[])
                      : []),
              ])
            : []),
        ...(futureRows
            ? ([
                  {
                      label: "Revenue tax",
                      kind: "line",
                      future: true,
                      cell: (f) => (
                          <Amount
                              value={seasonSheet(f, futureRows).revenueTax}
                              cost
                          />
                      ),
                  },
                  ...(detailed
                      ? ([
                            {
                                label: `${pct(REVENUE_TAX_RATE)} of export revenue`,
                                kind: "detail",
                                future: true,
                                cell: () => "",
                            },
                        ] satisfies Row[])
                      : []),
                  {
                      label: "Fuel cost",
                      kind: "line",
                      future: true,
                      cell: () => (
                          <span className="text-muted-foreground">#1009</span>
                      ),
                  },
              ] satisfies Row[])
            : []),
        {
            label: "Operating income",
            kind: "subtotal",
            cell: (f) => (
                <Amount value={seasonSheet(f, futureRows).operatingIncome} />
            ),
        },
        ...(futureRows
            ? ([
                  {
                      label: "Carbon tax",
                      kind: "line",
                      future: true,
                      cell: (f) => (
                          <Amount
                              value={seasonSheet(f, futureRows).carbonTax}
                              cost
                          />
                      ),
                  },
                  ...(detailed
                      ? ([
                            {
                                label: "CO₂ emitted",
                                kind: "detail",
                                future: true,
                                cell: (f) => tonnes(f.emissions),
                            },
                            {
                                label: `Paid (${CARBON_TAX_PER_TONNE} $/t)`,
                                kind: "detail",
                                future: true,
                                cell: (f) => (
                                    <Amount
                                        value={
                                            seasonSheet(f, futureRows)
                                                .carbonTaxPaid
                                        }
                                        cost
                                    />
                                ),
                            },
                            {
                                label: "Received (shared out)",
                                kind: "detail",
                                future: true,
                                cell: (f) => (
                                    <Amount
                                        value={
                                            seasonSheet(f, futureRows)
                                                .carbonTaxReceived
                                        }
                                    />
                                ),
                            },
                        ] satisfies Row[])
                      : []),
              ] satisfies Row[])
            : []),
        {
            label: "Investments",
            kind: "line",
            round: <Amount value={invest} cost />,
        },
        ...(detailed
            ? round.investments.map(
                  (i): Row => ({
                      label: `${i.facility} ×${i.count}`,
                      kind: "detail",
                      round: <Amount value={i.count * i.unitPrice} cost />,
                  }),
              )
            : []),
        {
            label: "Net profit",
            kind: "total",
            round: <Amount value={operating - carbon - invest} />,
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <TypographyH2>Round {round.round}</TypographyH2>
                <div className="flex items-center gap-2">
                    <Switch
                        id="ledger-detailed"
                        checked={detailed}
                        onCheckedChange={setDetailed}
                    />
                    <Label htmlFor="ledger-detailed">Detailed view</Label>
                </div>
            </div>
            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium" />
                            {SEASONS.map((season) => {
                                const state = round.seasons[season];
                                return (
                                    <th
                                        key={season}
                                        className="px-3 py-2 text-right font-medium"
                                    >
                                        <span className="inline-flex items-center gap-1.5">
                                            {state.status === "done" &&
                                                state.figures.blackout && (
                                                    <BlackoutMark />
                                                )}
                                            {SEASON_LABELS[season]}
                                        </span>
                                    </th>
                                );
                            })}
                            <th className="border-l px-3 py-2 text-right font-semibold">
                                Round {round.round}
                                {!roundClosed(round) && (
                                    <div className="text-xs font-normal text-muted-foreground">
                                        so far
                                    </div>
                                )}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <Fragment key={i}>
                                <tr
                                    className={cn(
                                        "border-t",
                                        row.kind === "detail" &&
                                            "border-dashed text-muted-foreground",
                                        row.kind === "subdetail" &&
                                            "border-none text-xs text-muted-foreground",
                                        row.kind === "subtotal" &&
                                            "border-t-2 bg-muted/30 font-semibold",
                                        row.kind === "total" &&
                                            "border-t-2 border-double bg-muted/50 text-base font-bold",
                                        row.future && "italic",
                                    )}
                                >
                                    <td
                                        className={cn(
                                            "px-3 py-1.5",
                                            row.kind === "detail" && "pl-8",
                                            row.kind === "subdetail" && "pl-14",
                                        )}
                                    >
                                        {row.label}
                                    </td>
                                    {SEASONS.map((season) => {
                                        const state = round.seasons[season];
                                        let content: ReactNode = null;
                                        if (row.cell) {
                                            if (state.status === "done")
                                                content = row.cell(
                                                    state.figures,
                                                );
                                            else if (state.status === "future")
                                                content = <Dash />;
                                            else if (
                                                row.kind === "line" ||
                                                row.kind === "subtotal"
                                            )
                                                content = <SkippedCell />;
                                        }
                                        return (
                                            <td
                                                key={season}
                                                className={cn(
                                                    "px-3 py-1.5 text-right whitespace-nowrap",
                                                    state.status ===
                                                        "skipped" &&
                                                        "bg-amber-500/5",
                                                )}
                                            >
                                                {content}
                                            </td>
                                        );
                                    })}
                                    <td className="border-l px-3 py-1.5 text-right whitespace-nowrap">
                                        {row.round ??
                                            (row.cell && total ? (
                                                row.cell(total)
                                            ) : (
                                                <Dash />
                                            ))}
                                    </td>
                                </tr>
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
