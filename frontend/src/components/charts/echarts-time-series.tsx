/**
 * The persistent world's time-series chart: the shared {@link TimeSeriesChart}
 * on an axis that counts back from the current game tick, with the rightmost
 * point as "now", and facility labels by default.
 */

import { useEffect, useMemo, useRef } from "react";

import { FacilityIcon } from "@/components/ui/asset-icon";
import { FacilityName } from "@/components/ui/asset-name";
import { useGameEngine } from "@/hooks/use-game";
import { useGameTick } from "@/hooks/use-game-tick";
import { getAssetIcon } from "@/lib/assets/asset-icons";
import { getAssetLongName } from "@/lib/assets/asset-names";
import { KEY_ORDER_BY_CHART_TYPE } from "@/lib/charts/key-order";
import type { ChartType } from "@/types/charts";
import {
    type EChartsTimeSeriesConfig,
    type EChartsTimeSeriesProps,
    type TimeAxis,
    TimeSeriesChart,
} from "@energetica/charts/components/time-series-chart";
import { formatDuration } from "@energetica/core/format-utils";

/**
 * The config fields for a persistent-world chart type: its name, so switching
 * chart types resets the zoom, and its series order.
 */
export function chartTypeConfig(
    chartType: ChartType,
): Required<Pick<EChartsTimeSeriesConfig, "kind" | "keyOrder">> {
    return { kind: chartType, keyOrder: KEY_ORDER_BY_CHART_TYPE[chartType] };
}

/** A facility's icon and long name, as a series label. */
export function formatFacilityLabel(key: string) {
    return (
        <div className="flex items-center gap-1">
            <FacilityIcon facility={key} size={14} />
            <FacilityName facility={key} mode="long" />
        </div>
    );
}

/**
 * A series label: the facility's icon and name when the key maps to a known
 * asset, or text for synthetic keys (e.g. "temperature", "CO2", "net-profit").
 */
export function formatAssetLabel(key: string) {
    return getAssetIcon(key) ? formatFacilityLabel(key) : getAssetLongName(key);
}

/**
 * The time axis of the persistent world's charts, counting back from the
 * current game tick, with the rightmost point as "now".
 */
export function useGameTimeAxis(): TimeAxis {
    const { data: gameEngine } = useGameEngine();
    const { currentTick } = useGameTick();

    // Keep currentTick in a ref so the axis and tooltip stay fresh without
    // a new time axis, and so a zoom reset, on every game tick.
    const currentTickRef = useRef(currentTick);
    useEffect(() => {
        currentTickRef.current = currentTick;
    }, [currentTick]);

    return useMemo((): TimeAxis => {
        const ago = (tick: number): string | null => {
            const ct = currentTickRef.current;
            if (!gameEngine || ct === undefined) return null;
            return formatDuration(ct - tick - 1, gameEngine);
        };
        return {
            formatTick: (tick, isLast) =>
                isLast ? "now" : (ago(tick) ?? "--"),
            formatTooltipTitle: (tick) => {
                const duration = ago(tick);
                return duration === null ? "--" : `${duration} ago`;
            },
            secondsPerTick: gameEngine?.game_seconds_per_tick ?? 0,
            anchor: "right",
        };
    }, [gameEngine]);
}

/**
 * {@link TimeSeriesChart} on the persistent world's game ticks, with facility
 * labels unless the config sets its own.
 *
 * Callers should memoize the `config` object to prevent unnecessary re-renders.
 */
export function EChartsTimeSeries({
    config,
    ...props
}: EChartsTimeSeriesProps) {
    const timeAxis = useGameTimeAxis();
    const labelledConfig = useMemo(
        () =>
            config.formatLabel
                ? config
                : { ...config, formatLabel: formatAssetLabel },
        [config],
    );
    return (
        <TimeSeriesChart
            {...props}
            config={labelledConfig}
            timeAxis={timeAxis}
        />
    );
}
