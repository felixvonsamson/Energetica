import { useState, useEffect, type RefObject } from "react";

/**
 * Chart area dimensions from Recharts internal layout.
 */
export interface ChartArea {
    left: number;
    top: number;
    width: number;
    height: number;
}

/**
 * Hook to measure the actual chart plotting area from Recharts internals.
 *
 * Queries the CartesianGrid element which defines the exact chart plotting area
 * coordinates. This is more reliable than measuring axes, which have labels in
 * separate groups.
 *
 * Re-measures when dependencies change (e.g., axis tick values change).
 *
 * @param containerRef - Ref to the container element that holds the Recharts chart
 * @param dependencies - Values that trigger re-measurement when changed (e.g., max tick values)
 * @returns Chart area dimensions, or null if not yet measured
 */
export function useRechartsChartArea(
    containerRef: RefObject<HTMLDivElement | null>,
    dependencies: unknown[] = [],
): ChartArea | null {
    const [chartArea, setChartArea] = useState<ChartArea | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Defer measurement to next animation frame to ensure Recharts has rendered
        const rafId = requestAnimationFrame(() => {
            if (!containerRef.current) return;

            // Query for the CartesianGrid which defines the exact chart plotting area
            // This is more reliable than measuring axes, which have labels in separate groups
            const gridElement = containerRef.current.querySelector(
                ".recharts-cartesian-grid",
            ) as SVGGElement | null;

            if (gridElement) {
                try {
                    // Get the bounding box of the grid - this IS the chart area
                    const bbox = gridElement.getBBox();

                    const newArea: ChartArea = {
                        left: bbox.x,
                        top: bbox.y,
                        width: bbox.width,
                        height: bbox.height,
                    };

                    // Only update if meaningfully changed
                    setChartArea((prev) => {
                        if (
                            !prev ||
                            Math.abs(prev.left - newArea.left) > 1 ||
                            Math.abs(prev.top - newArea.top) > 1 ||
                            Math.abs(prev.width - newArea.width) > 1 ||
                            Math.abs(prev.height - newArea.height) > 1
                        ) {
                            return newArea;
                        }
                        return prev;
                    });
                } catch {
                    // getBBox can fail in some edge cases, ignore
                }
            }
        });

        return () => cancelAnimationFrame(rafId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies); // Re-measure when dependencies change

    return chartArea;
}
