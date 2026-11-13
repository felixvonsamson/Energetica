/**
 * MapTooltip component - displays resource information when hovering over a
 * tile.
 */

import { PlayerName } from "@/components/ui/player-name";
import type { ApiResponse } from "@/types/api-helpers";
import type { Player } from "@/types/players";
import {
    buildResourceBars,
    calculateTooltipPosition,
    TOOLTIP_WIDTH,
} from "@energetica/map/lib/map-resources";

type HexTileData = ApiResponse<"/api/v1/map", "get">[number];

interface MapTooltipProps {
    tile: HexTileData;
    player: Player | null;
    distance: number;
    x: number;
    y: number;
    viewportWidth: number;
    viewportHeight: number;
}

export function MapTooltip({
    tile,
    player,
    distance,
    x,
    y,
    viewportWidth,
    viewportHeight,
}: MapTooltipProps) {
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
                    {player ? (
                        <PlayerName
                            player={player}
                            className="justify-center"
                        />
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

                {/* Distance */}
                <div className="text-center text-foreground text-base mt-4">
                    Distance:{" "}
                    {Number.isInteger(distance)
                        ? distance
                        : distance.toFixed(1)}{" "}
                    {distance === 1 ? "tile" : "tiles"}
                </div>
            </div>
        </div>
    );
}
