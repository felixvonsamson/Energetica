/**
 * PROTOTYPE (#1008) — throwaway. Variant B, "Waterfall": one period at a time.
 * A strip of season tiles across the top picks the period (or the whole Round).
 * Below it, a single-column statement where each line is a step of a waterfall
 * chart, from income down to profit. The detailed view writes out each line's
 * sum in words under it ("12.9 GWh × 68.3 $/MWh = …").
 */

import { type ReactNode, useState } from "react";

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
    type Season,
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

type Period = Season | "round";

interface Step {
    label: string;
    /** A change to the running total, or a total drawn from zero. */
    value: number;
    total?: boolean;
    detail?: ReactNode;
    future?: boolean;
}

export function WaterfallVariant({ round, futureRows }: VariantProps) {
    const [detailed, setDetailed] = useState(false);
    const lastDone = [...SEASONS]
        .reverse()
        .find((s) => round.seasons[s].status === "done");
    const [period, setPeriod] = useState<Period>(lastDone ?? "round");

    const figures: SeasonFigures | null =
        period === "round"
            ? roundFigures(round)
            : round.seasons[period].status === "done"
              ? (round.seasons[period] as { figures: SeasonFigures }).figures
              : null;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <TypographyH2>Round {round.round}</TypographyH2>
                <div className="flex items-center gap-2">
                    <Switch
                        id="waterfall-detailed"
                        checked={detailed}
                        onCheckedChange={setDetailed}
                    />
                    <Label htmlFor="waterfall-detailed">Detailed view</Label>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {SEASONS.map((season) => {
                    const state = round.seasons[season];
                    return (
                        <button
                            type="button"
                            key={season}
                            disabled={state.status !== "done"}
                            onClick={() => setPeriod(season)}
                            className={cn(
                                "rounded-lg border p-3 text-left transition-colors enabled:hover:bg-muted/50",
                                period === season &&
                                    "border-primary ring-2 ring-primary/30",
                                state.status === "skipped" &&
                                    "border-amber-500/40 bg-amber-500/5",
                                state.status === "future" && "opacity-60",
                            )}
                        >
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                {SEASON_LABELS[season]}
                                {state.status === "done" &&
                                    state.figures.blackout && (
                                        <BlackoutMark label />
                                    )}
                            </div>
                            <div className="mt-1 text-lg font-semibold">
                                {state.status === "done" ? (
                                    <Amount
                                        value={
                                            seasonSheet(
                                                state.figures,
                                                futureRows,
                                            ).operatingIncome
                                        }
                                    />
                                ) : state.status === "skipped" ? (
                                    <SkippedCell />
                                ) : (
                                    <Dash />
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                operating income
                            </div>
                        </button>
                    );
                })}
                <button
                    type="button"
                    onClick={() => setPeriod("round")}
                    className={cn(
                        "rounded-lg border-2 bg-muted/40 p-3 text-left transition-colors hover:bg-muted/60",
                        period === "round" &&
                            "border-primary ring-2 ring-primary/30",
                    )}
                >
                    <div className="text-xs text-muted-foreground">
                        Round {round.round} {roundClosed(round) ? "" : "so far"}
                    </div>
                    <div className="mt-1 text-lg font-bold">
                        {figures || roundFigures(round) ? (
                            <Amount
                                value={netProfit(
                                    roundFigures(round),
                                    round,
                                    futureRows,
                                )}
                            />
                        ) : (
                            <Dash />
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        net profit
                    </div>
                </button>
            </div>

            {figures ? (
                <Waterfall
                    steps={steps(figures, period, round, futureRows)}
                    detailed={detailed}
                    title={
                        period === "round"
                            ? `Round ${round.round}${roundClosed(round) ? "" : " so far"}`
                            : SEASON_LABELS[period]
                    }
                />
            ) : (
                <p className="text-muted-foreground">Nothing simulated yet.</p>
            )}
        </div>
    );
}

function netProfit(
    f: SeasonFigures | null,
    round: VariantProps["round"],
    futureRows: boolean,
) {
    if (!f) return -investmentTotal(round);
    const sheet = seasonSheet(f, futureRows);
    return sheet.operatingIncome - sheet.carbonTax - investmentTotal(round);
}

function steps(
    f: SeasonFigures,
    period: Period,
    round: VariantProps["round"],
    futureRows: boolean,
): Step[] {
    const s = seasonSheet(f, futureRows);
    const operating = s.operatingIncome;
    const result: Step[] = [
        {
            label: "Market income",
            value: s.marketIncome,
            detail: (
                <>
                    <div>
                        Export: {mwh(f.exportVolume)} ×{" "}
                        <PerMwh price={f.exportPrice} /> ={" "}
                        <Amount value={s.exportRevenue} />
                    </div>
                    <div>
                        Import (storage): {mwh(f.importVolume)} ×{" "}
                        <PerMwh price={f.importPrice} /> ={" "}
                        <Amount value={s.importCost} cost />
                    </div>
                </>
            ),
        },
        {
            label: "Dumping cost",
            value: -s.dumpCost,
            detail: (
                <div>
                    {mwh(f.dumpVolume)} dumped × <PerMwh price={DUMP_PRICE} />
                </div>
            ),
        },
        {
            label: "O&M",
            value: -s.om,
            detail: (
                <ul className="space-y-0.5">
                    {f.om.map((line) => (
                        <li
                            key={line.facility}
                            className="flex flex-wrap gap-x-2"
                        >
                            <span className="w-48">
                                {line.facility} ×{line.count}
                            </span>
                            <Amount value={omTotal(line)} cost />
                            <span className="text-xs">
                                (fixed <Amount value={line.fixed} />
                                {line.variableFull > 0 && (
                                    <>
                                        {" "}
                                        + {pct(line.usage)} ×{" "}
                                        <Amount value={line.variableFull} /> ={" "}
                                        <Amount value={omVariable(line)} />
                                    </>
                                )}
                                )
                            </span>
                        </li>
                    ))}
                </ul>
            ),
        },
    ];
    if (futureRows) {
        result.push(
            {
                label: "Revenue tax",
                value: -s.revenueTax,
                future: true,
                detail: <div>{pct(REVENUE_TAX_RATE)} of export revenue</div>,
            },
            {
                label: "Fuel cost",
                value: 0,
                future: true,
                detail: <div>To be settled in #1009</div>,
            },
        );
    }
    result.push({ label: "Operating income", value: operating, total: true });
    if (futureRows) {
        result.push({
            label: "Carbon tax",
            value: -s.carbonTax,
            future: true,
            detail: (
                <div>
                    {tonnes(f.emissions)} CO₂ × {CARBON_TAX_PER_TONNE} $/t ={" "}
                    <Amount value={s.carbonTaxPaid} cost />, shared out to you:{" "}
                    <Amount value={s.carbonTaxReceived} />
                </div>
            ),
        });
    }
    if (period === "round") {
        result.push(
            {
                label: "Investments",
                value: -investmentTotal(round),
                detail: (
                    <ul>
                        {round.investments.map((i) => (
                            <li key={i.facility}>
                                {i.facility} ×{i.count}:{" "}
                                <Amount value={i.count * i.unitPrice} cost />
                            </li>
                        ))}
                    </ul>
                ),
            },
            {
                label: "Net profit",
                value: netProfit(f, round, futureRows),
                total: true,
            },
        );
    } else {
        result.push({
            label: "Net profit",
            value: 0,
            total: true,
            detail: (
                <div>
                    Investments are paid once per Round: see the Round tile.
                </div>
            ),
        });
    }
    return result;
}

function Waterfall({
    steps,
    detailed,
    title,
}: {
    steps: Step[];
    detailed: boolean;
    title: string;
}) {
    // Where each bar starts and ends on the running total.
    const bars = steps.reduce<{ from: number; to: number }[]>((acc, step) => {
        const running = acc.at(-1)?.to ?? 0;
        acc.push(
            step.total
                ? { from: 0, to: step.value }
                : { from: running, to: running + step.value },
        );
        return acc;
    }, []);
    const lo = Math.min(0, ...bars.flatMap((b) => [b.from, b.to]));
    const hi = Math.max(0, ...bars.flatMap((b) => [b.from, b.to]));
    const at = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;

    return (
        <div className="rounded-lg border p-4">
            <div className="mb-3 text-sm font-semibold">{title}</div>
            <div className="divide-y">
                {steps.map((step, i) => {
                    const { from, to } = bars[i]!;
                    const isPeriodNet =
                        step.label === "Net profit" &&
                        step.value === 0 &&
                        step.detail;
                    return (
                        <div
                            key={step.label}
                            className={cn(
                                "py-2",
                                step.future && "italic",
                                step.total && "font-semibold",
                            )}
                        >
                            <div className="grid grid-cols-[10rem_1fr_8rem] items-center gap-3">
                                <span>{step.label}</span>
                                <div className="relative h-5">
                                    <div
                                        className="absolute inset-y-0 border-l border-dashed border-muted-foreground/50"
                                        style={{ left: `${at(0)}%` }}
                                    />
                                    {!isPeriodNet && (
                                        <div
                                            className={cn(
                                                "absolute inset-y-0.5 rounded-sm",
                                                step.total
                                                    ? "bg-primary"
                                                    : step.value >= 0
                                                      ? "bg-emerald-500"
                                                      : "bg-red-500",
                                                step.future && "opacity-50",
                                            )}
                                            style={{
                                                left: `${at(Math.min(from, to))}%`,
                                                width: `${Math.max(0.3, Math.abs(at(to) - at(from)))}%`,
                                            }}
                                        />
                                    )}
                                </div>
                                <span className="text-right">
                                    {isPeriodNet ? (
                                        <Dash />
                                    ) : step.label === "Fuel cost" ? (
                                        <span className="text-muted-foreground">
                                            #1009
                                        </span>
                                    ) : (
                                        <Amount value={step.value} />
                                    )}
                                </span>
                            </div>
                            {detailed && step.detail && (
                                <div className="mt-1 ml-4 text-sm font-normal text-muted-foreground">
                                    {step.detail}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
