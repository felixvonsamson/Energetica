/**
 * The recap map's hover panel — same resource-bar info as the in-game
 * `MapTooltip` (via the shared `buildResourceBars`/`calculateTooltipPosition`
 * helpers in `map-resources.ts`), minus the pieces that only make sense for a
 * live session: no "Distance" line (there's no "my tile" to measure from in a
 * frozen recap, no current player) and no activity dot / "You" badge (a frozen
 * photograph has no online presence to show).
 */

import {
    buildResourceBars,
    calculateTooltipPosition,
    TOOLTIP_WIDTH,
} from "@/lib/map-resources";
import type { HexTileResources } from "@/types/map";

interface RecapMapTooltipProps {
    tile: HexTileResources;
    /** The settling player's username at freeze, or null for a vacant tile. */
    ownerName: string | null;
    x: number;
    y: number;
    viewportWidth: number;
    viewportHeight: number;
}

export function RecapMapTooltip({
    tile,
    ownerName,
    x,
    y,
    viewportWidth,
    viewportHeight,
}: RecapMapTooltipProps) {
    const { left, top } = calculateTooltipPosition(
        x,
        y,
        viewportWidth,
        viewportHeight,
    );
    const resources = buildResourceBars(tile);

    return (
        <div
            className="absolute pointer-events-none"
            style={{
                left: `calc(50% + ${left}px)`,
                top: `calc(50% + ${top}px)`,
                width: `${TOOLTIP_WIDTH}px`,
            }}
        >
            <div className="bg-card border border-border px-6 py-3 rounded shadow-lg">
                {/* Title */}
                <div className="text-center text-xl mb-3">
                    {ownerName ? (
                        <span>{ownerName}</span>
                    ) : (
                        <span className="text-brand-green dark:text-gray-100">
                            Vacant tile
                        </span>
                    )}
                </div>

                {/* Resources */}
                <div className="space-y-2">
                    {resources.map((resource) => {
                        const barWidthPercent =
                            (resource.value / resource.maxValue) * 100;
                        return (
                            <div key={resource.name}>
                                <div className="flex justify-between text-foreground text-sm mb-1">
                                    <span>{resource.name}</span>
                                    <span>{resource.displayValue}</span>
                                </div>
                                <div className="relative h-1 bg-muted rounded">
                                    <div
                                        className="absolute h-full rounded"
                                        style={{
                                            width: `${barWidthPercent}%`,
                                            backgroundColor: resource.color,
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
