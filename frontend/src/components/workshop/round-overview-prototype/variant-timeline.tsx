/**
 * PROTOTYPE (#1008) — throwaway. Variant C, "Timeline cards": the Round told in
 * order, as the session runs it. An Investment card comes first (where the
 * Round's facility spending, and later perhaps fuel, lands), then one card per
 * season, each a small statement of its own. Below, the Round result written as
 * one equation in large type. The detailed view expands every card in place.
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

export function TimelineVariant({ round, futureRows }: VariantProps) {
    const [detailed, setDetailed] = useState(false);
    const total = roundFigures(round);
    const sheet = total ? seasonSheet(total, futureRows) : null;
    const invest = investmentTotal(round);
    const operating = sheet?.operatingIncome ?? 0;
    const carbon = sheet?.carbonTax ?? 0;
    const closed = roundClosed(round);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <TypographyH2>Round {round.round}</TypographyH2>
                <div className="flex items-center gap-2">
                    <Switch
                        id="timeline-detailed"
                        checked={detailed}
                        onCheckedChange={setDetailed}
                    />
                    <Label htmlFor="timeline-detailed">Detailed view</Label>
                </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(11rem,0.8fr)_repeat(4,minmax(0,1fr))]">
                <Card title="Investment" subtitle="once per Round">
                    <Line
                        label="Facilities"
                        value={<Amount value={invest} cost />}
                    />
                    {detailed &&
                        round.investments.map((i) => (
                            <Detail
                                key={i.facility}
                                label={`${i.facility} ×${i.count}`}
                            >
                                <Amount value={i.count * i.unitPrice} cost />
                            </Detail>
                        ))}
                    {futureRows && (
                        <Line
                            label="Fuel"
                            future
                            value={
                                <span className="text-muted-foreground">
                                    #1009
                                </span>
                            }
                        />
                    )}
                </Card>
                {SEASONS.map((season) => {
                    const state = round.seasons[season];
                    if (state.status === "future")
                        return (
                            <Card
                                key={season}
                                title={SEASON_LABELS[season]}
                                muted
                            >
                                <div className="py-6 text-center text-2xl">
                                    <Dash />
                                </div>
                            </Card>
                        );
                    if (state.status === "skipped")
                        return (
                            <Card
                                key={season}
                                title={SEASON_LABELS[season]}
                                blackout
                            >
                                <div className="py-6 text-center">
                                    <SkippedCell />
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        not played
                                    </div>
                                </div>
                            </Card>
                        );
                    return (
                        <Card
                            key={season}
                            title={SEASON_LABELS[season]}
                            badge={
                                state.figures.blackout ? (
                                    <BlackoutMark label />
                                ) : undefined
                            }
                        >
                            <SeasonStatement
                                f={state.figures}
                                detailed={detailed}
                                futureRows={futureRows}
                            />
                        </Card>
                    );
                })}
            </div>

            <div className="rounded-xl border-2 bg-muted/30 p-5">
                <div className="mb-3 text-sm text-muted-foreground">
                    Round {round.round} {closed ? "result" : "so far"}
                </div>
                <div className="flex flex-wrap items-end gap-x-5 gap-y-3 text-2xl font-semibold">
                    <Term label="Operating income">
                        {sheet ? <Amount value={operating} /> : <Dash />}
                    </Term>
                    {futureRows && (
                        <>
                            <Op>−</Op>
                            <Term label="Carbon tax" future>
                                {sheet ? <Amount value={carbon} /> : <Dash />}
                            </Term>
                        </>
                    )}
                    <Op>−</Op>
                    <Term label="Investments">
                        <Amount value={invest} />
                    </Term>
                    <Op>=</Op>
                    <Term label="Net profit" strong>
                        <Amount value={operating - carbon - invest} />
                    </Term>
                </div>
                {futureRows && detailed && total && (
                    <div className="mt-3 text-sm text-muted-foreground">
                        Carbon tax: {tonnes(total.emissions)} CO₂ ×{" "}
                        {CARBON_TAX_PER_TONNE} $/t ={" "}
                        <Amount value={sheet!.carbonTaxPaid} cost />, shared out
                        to you: <Amount value={sheet!.carbonTaxReceived} />
                    </div>
                )}
            </div>
        </div>
    );
}

function SeasonStatement({
    f,
    detailed,
    futureRows,
}: {
    f: SeasonFigures;
    detailed: boolean;
    futureRows: boolean;
}) {
    const s = seasonSheet(f, futureRows);
    return (
        <>
            <Line
                label="Market income"
                value={<Amount value={s.marketIncome} />}
            />
            {detailed && (
                <>
                    <Detail label={`Sold ${mwh(f.exportVolume)}`}>
                        <Amount value={s.exportRevenue} />
                    </Detail>
                    <Sub>
                        at <PerMwh price={f.exportPrice} />
                    </Sub>
                    <Detail label={`Bought ${mwh(f.importVolume)}`}>
                        <Amount value={s.importCost} cost />
                    </Detail>
                    <Sub>
                        at <PerMwh price={f.importPrice} />
                    </Sub>
                </>
            )}
            <Line label="Dumping" value={<Amount value={s.dumpCost} cost />} />
            {detailed && (
                <Sub>
                    {mwh(f.dumpVolume)} at <PerMwh price={DUMP_PRICE} />
                </Sub>
            )}
            <Line label="O&M" value={<Amount value={s.om} cost />} />
            {detailed &&
                f.om.map((line) => (
                    <div key={line.facility}>
                        <Detail label={`${line.facility} ×${line.count}`}>
                            <Amount value={omTotal(line)} cost />
                        </Detail>
                        {line.variableFull > 0 && (
                            <Sub>
                                <Amount value={line.fixed} /> +{" "}
                                {pct(line.usage)} ×{" "}
                                <Amount value={line.variableFull} /> ={" "}
                                <Amount value={line.fixed} /> +{" "}
                                <Amount value={omVariable(line)} />
                            </Sub>
                        )}
                    </div>
                ))}
            {futureRows && (
                <>
                    <Line
                        label="Revenue tax"
                        future
                        value={<Amount value={s.revenueTax} cost />}
                    />
                    {detailed && <Sub>{pct(REVENUE_TAX_RATE)} of sales</Sub>}
                </>
            )}
            <div className="mt-2 flex items-baseline justify-between border-t-2 pt-2 font-semibold">
                <span>Operating income</span>
                <Amount value={s.operatingIncome} />
            </div>
            {futureRows && detailed && (
                <Sub>Emitted {tonnes(f.emissions)} CO₂</Sub>
            )}
        </>
    );
}

function Card({
    title,
    subtitle,
    badge,
    muted,
    blackout,
    children,
}: {
    title: string;
    subtitle?: string;
    badge?: ReactNode;
    muted?: boolean;
    blackout?: boolean;
    children: ReactNode;
}) {
    return (
        <div
            className={cn(
                "rounded-lg border bg-card p-3 text-sm",
                muted && "opacity-60",
                blackout && "border-amber-500/40 bg-amber-500/5",
            )}
        >
            <div className="mb-2 flex items-center justify-between gap-2 border-b pb-2">
                <div>
                    <div className="font-semibold">{title}</div>
                    {subtitle && (
                        <div className="text-xs text-muted-foreground">
                            {subtitle}
                        </div>
                    )}
                </div>
                {badge}
            </div>
            {children}
        </div>
    );
}

function Line({
    label,
    value,
    future,
}: {
    label: string;
    value: ReactNode;
    future?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex items-baseline justify-between gap-2 py-0.5",
                future && "italic",
            )}
        >
            <span>{label}</span>
            {value}
        </div>
    );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-2 pl-3 text-xs text-muted-foreground">
            <span>{label}</span>
            {children}
        </div>
    );
}

function Sub({ children }: { children: ReactNode }) {
    return (
        <div className="pb-1 pl-6 text-xs text-muted-foreground">
            {children}
        </div>
    );
}

function Term({
    label,
    children,
    strong,
    future,
}: {
    label: string;
    children: ReactNode;
    strong?: boolean;
    future?: boolean;
}) {
    return (
        <div className={cn(future && "italic")}>
            <div className="text-xs font-normal text-muted-foreground">
                {label}
            </div>
            <div className={cn(strong && "text-3xl font-bold")}>{children}</div>
        </div>
    );
}

function Op({ children }: { children: ReactNode }) {
    return <div className="pb-1 text-muted-foreground">{children}</div>;
}
