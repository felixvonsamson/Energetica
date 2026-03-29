export type Resolution = 1 | 6 | 36 | 216 | 1296;
export type StringResolution = "1" | "6" | "36" | "216" | "1296";
export type ChartType =
    | "power-sources"
    | "power-sinks"
    | "storage-level"
    | "revenues"
    | "op-costs"
    | "emissions"
    | "climate"
    | "temperature"
    | "resources"
    | "market-clearing"
    | "market-exports"
    | "market-imports"
    | "market-generation"
    | "market-consumption";

export interface ResolutionOption {
    id: number;
    label: string;
    resolution: Resolution;
    datapoints: number;
}

export const resolutions: ResolutionOption[] = [
    { id: 0, label: "4h", resolution: 1, datapoints: 60 },
    { id: 1, label: "24h", resolution: 1, datapoints: 360 },
    { id: 2, label: "6 days", resolution: 6, datapoints: 360 },
    { id: 3, label: "6 months", resolution: 36, datapoints: 360 },
    { id: 4, label: "3 years", resolution: 216, datapoints: 360 },
    { id: 5, label: "18 years", resolution: 1296, datapoints: 360 },
];

/**
 * Convert numeric resolution to string resolution. Useful for API calls or
 * query keys that expect string values.
 */
export function toStringResolution(resolution: Resolution): StringResolution {
    return String(resolution) as StringResolution;
}

/**
 * Convert string resolution to numeric resolution. Useful for parsing URL
 * params or API responses.
 */
export function toNumericResolution(resolution: StringResolution): Resolution {
    return Number(resolution) as Resolution;
}

/** @todo Write docs */
export interface TickRange {
    startTick: number; // Aligned to resolution
    count: number; // Number of datapoints (not ticks)
}
