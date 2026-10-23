/**
 * PROTOTYPE (#1289) — throwaway. Three layouts for the control-room dashboard
 * on a 1920×1080 canvas, switchable with `?variant=`.
 *
 * - A, operator wall: a grid of equal tiles, every figure the same weight, and
 *   the alarms in a ticker along the bottom.
 * - B, centre stage: the capacity-against-demand panel large in the middle, with
 *   a control-room alarm list down the left side.
 * - C, trend wall: every history chart shares the same Trading-period axis, one
 *   strip under the other, with the live figures in a column on the right.
 */

import { DIM, INK } from "./charts";
import { FUELS } from "./mock-data";
import {
    AlarmList,
    AlarmTicker,
    BoxLegend,
    CapacityPanel,
    CarbonStatus,
    Co2Meter,
    Countdown,
    DurationCurveChart,
    FuelTile,
    GenerationMixChart,
    MarketPricesChart,
    Panel,
    PlayerPricesGrid,
    SessionStatus,
    useCountdown,
    useLiveCapacity,
} from "./panels";

export const VARIANTS = [
    { key: "A", name: "Operator wall" },
    { key: "B", name: "Centre stage" },
    { key: "C", name: "Trend wall" },
    { key: "D", name: "Centre stage, reworked" },
];

function Fuels({ direction }: { direction: "row" | "column" }) {
    return (
        <div className="flex h-full flex-col gap-2">
            {FUELS.map((_, i) => (
                <div
                    key={i}
                    className="min-h-0 flex-1 border-b last:border-b-0"
                    style={{ borderColor: "#1d2b40" }}
                >
                    <FuelTile index={i} direction={direction} />
                </div>
            ))}
        </div>
    );
}

export function VariantA() {
    const seconds = useCountdown();
    const capacity = useLiveCapacity();
    return (
        <div className="flex h-full flex-col gap-2 p-3">
            <div className="flex h-[96px] shrink-0 items-center justify-between px-2">
                <SessionStatus />
                <div className="flex items-center gap-10">
                    <CarbonStatus />
                    <Countdown seconds={seconds} className="text-[84px]" />
                </div>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-3 gap-2">
                <Panel
                    title="Capacity vs must-serve demand · this Round"
                    className="col-span-2"
                >
                    <CapacityPanel capacity={capacity} size="compact" />
                </Panel>
                <Panel title="Fuel prices" className="row-span-2">
                    <Fuels direction="column" />
                </Panel>
                <Panel title="Room CO₂ emissions">
                    <Co2Meter />
                </Panel>
                <Panel
                    title="Market price per season · average and 10–90% range"
                    className="col-span-2"
                >
                    <MarketPricesChart />
                </Panel>
                <Panel title="Price duration · last season">
                    <DurationCurveChart />
                </Panel>
                <Panel
                    title="Room prices per facility type"
                    className="col-span-2"
                    right={<BoxLegend />}
                >
                    <PlayerPricesGrid cols={4} fontSize={12} labels={false} />
                </Panel>
                <Panel
                    title="Generation mix · last season's week"
                    className="col-span-2"
                >
                    <GenerationMixChart fontSize={14} />
                </Panel>
            </div>
            <div
                className="h-[52px] shrink-0 rounded-sm border bg-[#0a1220] px-3"
                style={{ borderColor: "#1d2b40" }}
            >
                <AlarmTicker />
            </div>
        </div>
    );
}

export function VariantB() {
    const seconds = useCountdown();
    const capacity = useLiveCapacity();
    return (
        <div className="grid h-full grid-cols-[520px_1fr_400px] gap-2 p-3">
            <div className="flex min-h-0 flex-col gap-2">
                <Panel title="Alarms" className="flex-[1.3]">
                    <AlarmList />
                </Panel>
                <Panel title="Market price per season" className="flex-1">
                    <MarketPricesChart fontSize={14} />
                </Panel>
            </div>

            <div className="flex min-h-0 flex-col gap-2">
                <div className="flex h-[84px] shrink-0 items-center justify-center">
                    <SessionStatus size="lg" />
                </div>
                <Panel
                    title="Capacity vs must-serve demand · this Round"
                    className="h-[430px] shrink-0"
                >
                    <CapacityPanel capacity={capacity} size="large" />
                </Panel>
                <Panel
                    title="Generation mix · last season's week"
                    className="min-h-0 flex-1"
                >
                    <GenerationMixChart fontSize={14} />
                </Panel>
                <Panel
                    title="Room prices per facility type"
                    className="h-[190px] shrink-0"
                    right={<BoxLegend />}
                >
                    <PlayerPricesGrid cols={8} fontSize={12} labels={false} />
                </Panel>
            </div>

            <div className="flex min-h-0 flex-col gap-2">
                <Panel title="Phase ends in" className="h-[200px] shrink-0">
                    <div className="flex h-full items-center justify-center">
                        <Countdown seconds={seconds} className="text-[130px]" />
                    </div>
                </Panel>
                <Panel title="Fuel prices" className="flex-[1.4]">
                    <Fuels direction="row" />
                </Panel>
                <Panel title="Carbon" className="flex-1">
                    <div className="flex h-full flex-col gap-2">
                        <CarbonStatus />
                        <Co2Meter />
                    </div>
                </Panel>
            </div>
        </div>
    );
}

export function VariantC() {
    const seconds = useCountdown();
    const capacity = useLiveCapacity();
    return (
        <div className="grid h-full grid-cols-[1fr_640px] gap-2 p-3">
            <div className="flex min-h-0 flex-col gap-2">
                <Panel
                    title="Market price per season · average and 10–90% range"
                    className="h-[210px] shrink-0"
                >
                    <MarketPricesChart fontSize={14} />
                </Panel>
                <Panel
                    title="Room prices per facility type"
                    className="min-h-0 flex-1"
                    right={<BoxLegend />}
                >
                    <PlayerPricesGrid cols={4} fontSize={12} labels />
                </Panel>
                <Panel title="Fuel prices" className="h-[150px] shrink-0">
                    <div className="grid h-full grid-cols-3 gap-4">
                        {FUELS.map((_, i) => (
                            <FuelTile key={i} index={i} direction="row" />
                        ))}
                    </div>
                </Panel>
                <div className="grid h-[290px] shrink-0 grid-cols-[2fr_1fr] gap-2">
                    <Panel title="Generation mix · last season's week">
                        <GenerationMixChart fontSize={14} />
                    </Panel>
                    <Panel title="Price duration · last season">
                        <DurationCurveChart fontSize={14} />
                    </Panel>
                </div>
            </div>

            <div className="flex min-h-0 flex-col gap-2">
                <div
                    className="flex shrink-0 items-start justify-between px-2"
                    style={{ color: INK }}
                >
                    <div className="pt-2">
                        <div className="text-5xl font-bold tracking-wider whitespace-nowrap">
                            ROUND 3 / 5
                        </div>
                        <div className="text-2xl" style={{ color: "#4fc3ff" }}>
                            INVESTMENT PHASE
                        </div>
                        <div className="text-lg" style={{ color: DIM }}>
                            next: Spring · 18 players
                        </div>
                    </div>
                    <Countdown seconds={seconds} className="text-[110px]" />
                </div>
                <Panel
                    title="Capacity vs must-serve demand · this Round"
                    className="h-[360px] shrink-0"
                >
                    <CapacityPanel capacity={capacity} size="compact" narrow />
                </Panel>
                <Panel
                    title="Carbon"
                    className="h-[190px] shrink-0"
                    right={<CarbonStatus />}
                >
                    <Co2Meter />
                </Panel>
                <Panel title="Alarms" className="min-h-0 flex-1">
                    <AlarmList compact />
                </Panel>
            </div>
        </div>
    );
}
