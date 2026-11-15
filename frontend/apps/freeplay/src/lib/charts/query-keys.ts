import { ExcludePrefix, IncludePrefix } from "@/lib/type-utils";
import {
    ChartType,
    Resolution,
    TickRange,
    toStringResolution,
} from "@/types/charts";

type MarketChartType = IncludePrefix<ChartType, "market-">;

export type ChartIdentifier =
    | {
          chartType: ExcludePrefix<ChartType, "market-">;
      }
    | {
          chartType: MarketChartType;
          marketId: number;
      };

export type ChartQueryConfig = ChartIdentifier & {
    resolution: Resolution;
};

/** Extract the sub-type from a market chart type for query key construction */
function getMarketChartSubType(chartType: MarketChartType): string {
    const mapping = {
        "market-clearing": "clearing-data",
        "market-exports": "exports",
        "market-imports": "imports",
        "market-generation": "generation",
        "market-consumption": "consumption",
    } as const;
    return mapping[chartType];
}

/**
 * Extracts tick range from a query key. Both regular and market chart query
 * keys end with [..., startTick, count].
 */
export function extractRangeFromQueryKey(
    queryKey: readonly unknown[],
): TickRange | null {
    const len = queryKey.length;
    if (len < 2) return null;
    const count = queryKey[len - 1];
    const startTick = queryKey[len - 2];
    if (typeof startTick !== "number" || typeof count !== "number") return null;
    return { startTick, count };
}

/** Builds the query key prefix for a chart type and resolution. */
export function buildChartQueryKeyPrefix(
    config: ChartQueryConfig,
): readonly unknown[] {
    const isMarketChart = "marketId" in config;
    const resolutionStr = toStringResolution(config.resolution);

    if (isMarketChart) {
        // TypeScript knows config has marketId here due to discriminated union
        return [
            "charts",
            "markets",
            config.marketId,
            getMarketChartSubType(config.chartType),
            resolutionStr,
        ];
    }

    return ["charts", config.chartType, resolutionStr];
}

export function buildChartQueryKey(
    config: ChartQueryConfig,
    range: TickRange,
): readonly unknown[] {
    return [...buildChartQueryKeyPrefix(config), range.startTick, range.count];
}
