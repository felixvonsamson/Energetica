/**
 * The control room (#1289): one fixed 1920×1080 layout for every phase, with
 * nothing highlighted, since working out which figures matter is part of the
 * game.
 *
 * - Left, a third each: carbon, the market price per season, and the last
 *   season's price-duration curve.
 * - Centre: alarms, capacity against must-serve demand (#1287), then the room's
 *   prices per power source.
 * - Right: the Round, phase and countdown, then fuel prices and the room's
 *   generation per season.
 */

import { useEffect, useState } from "react";

import {
    useInvestmentOpen,
    usePriceSettingOpen,
    useWorkshopControlRoom,
    useWorkshopSession,
} from "@/hooks/use-workshop";
import { controlRoomPhase, periodLabel } from "@/lib/workshop-control-room";
import {
    formatCountdown,
    isFinalMinute,
    phaseDeadline,
} from "@/lib/workshop-countdown";
import { cn } from "@energetica/ui/lib/utils";

import {
    Alarms,
    Capacity,
    Carbon,
    CarbonTaxPill,
    DurationCurve,
    Fuels,
    Generation,
    MarketPrices,
    Panel,
    RoomPriceBoxes,
} from "./panels";
import { THEME } from "./theme";

export function ControlRoom() {
    const { data: room } = useWorkshopControlRoom();
    if (!room)
        return <div className="h-full" style={{ background: THEME.bg }} />;
    const last = room.duration_curve;
    return (
        <div
            className="grid h-full grid-cols-[470px_minmax(0,1fr)_540px] gap-2 p-3"
            style={{ background: THEME.bg }}
        >
            <div className="grid min-h-0 grid-rows-3 gap-2">
                <Panel
                    title="Carbon"
                    right={<CarbonTaxPill status={room.carbon_tax} />}
                >
                    <Carbon rounds={room.emissions} />
                </Panel>
                <Panel title="Market price per season">
                    <MarketPrices seasons={room.seasons} />
                </Panel>
                <Panel
                    title="Price duration · last season"
                    right={
                        last && (
                            <span className="font-mono tracking-normal normal-case">
                                {periodLabel(last.round, last.season)}
                            </span>
                        )
                    }
                >
                    <DurationCurve curve={last} />
                </Panel>
            </div>

            <div className="flex min-h-0 flex-col gap-2">
                <Panel title="Alarms" className="h-[250px] shrink-0">
                    <Alarms alarms={room.alarms} />
                </Panel>
                <Panel
                    title={`Capacity vs must-serve demand · Round ${room.capacity.round}`}
                    className="h-[352px] shrink-0"
                >
                    <Capacity outlook={room.capacity} />
                </Panel>
                <Panel
                    title="Room prices per power source"
                    className="min-h-0 flex-1"
                >
                    <RoomPriceBoxes periods={room.room_prices} />
                </Panel>
            </div>

            <div className="flex min-h-0 flex-col gap-2">
                <Header />
                <Panel title="Fuel prices" className="min-h-0 flex-1">
                    <Fuels fuels={room.fuels} />
                </Panel>
                <Panel
                    title="Room generation per season"
                    className="min-h-0 flex-[1.35]"
                >
                    <Generation seasons={room.seasons} />
                </Panel>
            </div>
        </div>
    );
}

/** The Round, the phase and what comes next, beside a large countdown. */
function Header() {
    const { data: session } = useWorkshopSession();
    const investmentOpen = useInvestmentOpen();
    const priceSettingOpen = usePriceSettingOpen();
    const remainingMs = useRemainingMs();
    if (!session) return <div className="h-[150px] shrink-0" />;
    const { round, phase, next } = controlRoomPhase(
        session,
        investmentOpen || priceSettingOpen,
    );
    const urgent = remainingMs !== null && isFinalMinute(remainingMs);
    return (
        <div
            className="flex h-[150px] shrink-0 items-center justify-between px-1"
            style={{ color: THEME.ink }}
        >
            <div>
                <div className="text-4xl font-bold tracking-wider whitespace-nowrap">
                    ROUND {round}
                    <span style={{ color: THEME.dim }}>
                        {" "}
                        / {session.round_count}
                    </span>
                </div>
                <div
                    className="mt-1 text-[24px] tracking-wide whitespace-nowrap uppercase"
                    style={{ color: THEME.accent }}
                >
                    {phase}
                </div>
                {next && (
                    <div className="mt-1 text-2xl whitespace-nowrap">
                        {next}
                    </div>
                )}
            </div>
            {remainingMs !== null && (
                <div
                    className={cn(
                        "font-mono text-[88px] leading-none font-bold tabular-nums",
                        urgent && "animate-pulse",
                    )}
                    style={{ color: urgent ? THEME.alarm.critical : THEME.ink }}
                >
                    {formatCountdown(remainingMs)}
                </div>
            )}
        </div>
    );
}

/** The time left on the running phase, or `null` while no phase is timed. */
function useRemainingMs(): number | null {
    const { data: session, dataUpdatedAt } = useWorkshopSession();
    const timer = session?.phase_timer;
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!timer) return;
        const id = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(id);
    }, [timer]);

    if (!timer) return null;
    // `now` stops moving while no phase is timed, so right after a new timer arrives it can be
    // older than the answer. The answer's arrival is a floor for the current time.
    return phaseDeadline(timer, dataUpdatedAt) - Math.max(now, dataUpdatedAt);
}
