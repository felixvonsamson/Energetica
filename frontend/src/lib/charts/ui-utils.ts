/** Point in a curve with quantity (x-axis) and price (y-axis) coordinates. */

export interface CurvePoint {
    quantity: number;
    price: number;
}
/**
 * Performs linear interpolation on a curve to find the Y value at a given X
 * position. Returns null if X is outside the curve's range.
 *
 * Useful for finding values at arbitrary positions along stepped or continuous
 * curves, such as supply/demand curves in market charts.
 */

export function interpolateAtX(
    curve: CurvePoint[],
    targetX: number,
): number | null {
    if (curve.length === 0) return null;
    if (targetX < 0) return null;

    // Find the two points that bracket targetX
    for (let i = 0; i < curve.length - 1; i++) {
        const p1 = curve[i];
        const p2 = curve[i + 1];

        if (!p1 || !p2) continue;

        // Check if targetX is between these two points
        if (targetX >= p1.quantity && targetX <= p2.quantity) {
            // Handle vertical segments (same quantity, different price)
            if (p2.quantity === p1.quantity) {
                return p2.price;
            }

            // Linear interpolation: y = y1 + (y2 - y1) * (x - x1) / (x2 - x1)
            const ratio = (targetX - p1.quantity) / (p2.quantity - p1.quantity);
            return p1.price + (p2.price - p1.price) * ratio;
        }
    }

    // If targetX is beyond the last point, return the last price
    const lastPoint = curve[curve.length - 1];
    if (lastPoint && targetX >= lastPoint.quantity) {
        return lastPoint.price;
    }

    return null;
}
/**
 * Transforms order data into a stepped curve for visualization. Creates points
 * for a ragged supply or demand curve from discrete orders.
 *
 * The resulting curve starts at (0,0), then for each order creates a vertical
 * step (price change) followed by a horizontal step (quantity change).
 *
 * @param prices - Price for each order
 * @param cumulCapacities - Cumulative quantity at each order
 * @param extensionPrice - Optional price to extend the curve vertically after
 *   the last order
 */

export function createSteppedCurve(
    prices: number[],
    cumulCapacities: number[],
    extensionPrice?: number,
): CurvePoint[] {
    if (prices.length === 0) return [];

    const points: CurvePoint[] = [];

    // Start at origin
    points.push({ quantity: 0, price: 0 });

    for (let i = 0; i < prices.length; i++) {
        const prevCumul = i === 0 ? 0 : (cumulCapacities[i - 1] ?? 0);
        const currCumul = cumulCapacities[i] ?? 0;
        const price = prices[i] ?? 0;

        // Add vertical step (price change at same quantity)
        points.push({ quantity: prevCumul, price });
        // Add horizontal step (quantity change at same price)
        points.push({ quantity: currCumul, price });
    }

    // Add vertical extension at the end if extensionPrice is provided
    if (extensionPrice !== undefined && prices.length > 0) {
        const lastQuantity = cumulCapacities[cumulCapacities.length - 1] ?? 0;
        points.push({ quantity: lastQuantity, price: extensionPrice });
    }

    return points;
}
/**
 * Generates predictable tick values for an axis based on the range. Uses round
 * numbers to provide a consistent frame of reference.
 *
 * Attempts to create ticks at "nice" intervals (1, 2, 5, or 10 times a power of
 * 10) that fit within the target count. Always includes the maximum value.
 *
 * @param min - Minimum value on the axis
 * @param max - Maximum value on the axis
 * @param targetCount - Desired number of ticks (default: 5)
 * @returns Array of tick values
 */

export function generateNiceTicks(
    min: number,
    max: number,
    targetCount = 5,
): number[] {
    const range = max - min;
    if (range === 0) return [min];

    // Calculate order of magnitude
    const roughStep = range / (targetCount - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));

    // Try different nice step sizes (1, 2, 5 multiplied by magnitude)
    const niceSteps = [1, 2, 5, 10].map((n) => n * magnitude);
    const step =
        niceSteps.find((s) => range / s <= targetCount) ??
        niceSteps[niceSteps.length - 1] ??
        magnitude;

    // Generate ticks
    const ticks: number[] = [];
    const startTick = Math.floor(min / step) * step;

    for (let tick = startTick; tick <= max; tick += step) {
        if (tick >= min) {
            ticks.push(tick);
        }
    }

    // Ensure max is included
    if (ticks[ticks.length - 1] !== max) {
        ticks.push(max);
    }

    return ticks;
}
