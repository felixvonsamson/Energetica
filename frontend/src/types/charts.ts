export type Resolution = 1 | 6 | 36 | 216 | 1296;
export type StringResolution = "1" | "6" | "36" | "216" | "1296";
export type ChartType = "power-sources" | "power-sinks" | "storage-level";

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
