/**
 * Calculate hexagon size constrained by both width and height. Uses the smaller
 * of the two constraints to ensure map fits in viewport.
 *
 * Map dimensions (for sizeParam=10):
 *
 * - Width: spans from -10 to +10 in q coordinate = 21 hexes wide
 * - Height: spans from -10 to +10 in r coordinate = 21 hexes tall
 * - Hex width = sqrt(3) * s
 * - Hex height = 2 * s (but they overlap, so vertical spacing = 1.5 * s)
 */
export function calculateHexSizeWithConstraints(
    canvasWidth: number,
    canvasHeight: number,
    sizeParam: number = 10,
    padding: number = 2,
): { s: number; w: number } {
    const diameter = 2 * sizeParam + 1;

    // Calculate s based on width constraint
    const sFromWidth = (canvasWidth - 2 * padding) / diameter / Math.sqrt(3);

    // Calculate s based on height constraint
    // Vertical extent: map goes from -sizeParam to +sizeParam in r coordinate
    // Height needed = (2*sizeParam + 1) * 1.5 * s (with some padding)
    // Solving for s: s = height / (1.5 * (2*sizeParam + 1))
    const sFromHeight = (2 * (canvasHeight - 2 * padding)) / (1 + 3 * diameter);

    // Use the smaller constraint to ensure map fits
    const s = Math.min(sFromWidth, sFromHeight);
    const w = s * Math.sqrt(3);

    return { s, w };
}
/**
 * Get hexagon vertices as a points string for SVG polygon.
 *
 * Uses pointy-top orientation (hexagons with points at top and bottom). The
 * hexagon is centred at (0, 0) and vertices are listed in clockwise order
 * starting from the bottom vertex.
 *
 * @param s - The hexagon size parameter (distance from center to vertex)
 * @param w - The width parameter (sqrt(3) * s, the horizontal distance between
 *   parallel sides)
 * @returns A space-separated string of "x,y" coordinates for use in SVG polygon
 *
 *   Vertex positions (in local coordinates, before transform):
 *
 *   Geometric properties:
 *
 *   - Height (point to point): 2s
 *   - Width (flat side to flat side): w = sqrt(3) * s
 *   - Each vertex is at distance s from the center
 *   - Angles between vertices: 60 degrees
 */

export function getHexagonPoints(s: number, w: number): string {
    return [
        [0, s], // Bottom vertex (6 o'clock)
        [0.5 * w, 0.5 * s], // Bottom-right vertex (4 o'clock)
        [0.5 * w, -0.5 * s], // Top-right vertex (2 o'clock)
        [0, -s], // Top vertex (12 o'clock)
        [-0.5 * w, -0.5 * s], // Top-left vertex (10 o'clock)
        [-0.5 * w, 0.5 * s], // Bottom-left vertex (8 o'clock)
    ]
        .map(([x, y]) => `${x},${y}`)
        .join(" ");
}
/** Calculate hex tile position from axial coordinates (q, r). */

export function getHexPosition(
    q: number,
    r: number,
    s: number,
    w: number,
): { x: number; y: number } {
    return {
        x: w * q + 0.5 * w * r,
        y: 1.5 * s * r,
    };
}
