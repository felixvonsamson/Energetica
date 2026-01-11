/**
 * MapTooltip component - displays resource information when hovering over a
 * tile.
 */

import type { ApiResponse } from "@/types/api-helpers";

type HexTileData = ApiResponse<"/api/v1/map", "get">[number];

interface MapTooltipProps {
    tile: HexTileData;
    username: string | null;
    distance: number;
    x: number;
    y: number;
    viewportWidth: number;
    viewportHeight: number;
}

interface ResourceInfo {
    name: string;
    value: number;
    maxValue: number;
    color: string; // HSL hue value
    displayValue: string;
}

const TOOLTIP_WIDTH = 200;
const TOOLTIP_HEIGHT = 360;

export function MapTooltip({
    tile,
    username,
    distance,
    x,
    y,
    viewportWidth,
    viewportHeight,
}: MapTooltipProps) {
    // Position tooltip to stay on screen
    let tooltipX = x + 40;
    let tooltipY = y - 40;

    if (tooltipX + TOOLTIP_WIDTH > viewportWidth / 2) {
        tooltipX -= TOOLTIP_WIDTH + 80;
    }
    if (tooltipY + TOOLTIP_HEIGHT > viewportHeight / 2) {
        tooltipY = viewportHeight / 2 - TOOLTIP_HEIGHT - 10;
    }

    // Resource data with max values and colors (from original code)
    const maxValues = [1, 1, 1, 2_000_000_000, 600_000_000, 8_000_000, 10];
    const resourceColors = [59, 186, 239, 0, 275, 109, 320]; // HSL hue values

    const resources: ResourceInfo[] = [
        {
            name: "Solar",
            value: tile.solar,
            maxValue: maxValues[0],
            color: `hsl(${resourceColors[0]}, 95%, 50%)`,
            displayValue: `${Math.round(tile.solar * 1000)} W/m²`,
        },
        {
            name: "Wind",
            value: tile.wind,
            maxValue: maxValues[1],
            color: `hsl(${resourceColors[1]}, 95%, 50%)`,
            displayValue: `${Math.round(Math.pow(tile.wind, 0.5) * 50)} km/h`,
        },
        {
            name: "Hydro",
            value: tile.hydro,
            maxValue: maxValues[2],
            color: `hsl(${resourceColors[2]}, 95%, 50%)`,
            displayValue: `${Math.round(tile.hydro * 150)} m³/s`,
        },
        {
            name: "Coal",
            value: tile.coal,
            maxValue: maxValues[3],
            color: `hsl(${resourceColors[3]}, 95%, 50%)`,
            displayValue: formatMass(tile.coal),
        },
        {
            name: "Gas",
            value: tile.gas,
            maxValue: maxValues[4],
            color: `hsl(${resourceColors[4]}, 95%, 50%)`,
            displayValue: formatMass(tile.gas),
        },
        {
            name: "Uranium",
            value: tile.uranium,
            maxValue: maxValues[5],
            color: `hsl(${resourceColors[5]}, 95%, 50%)`,
            displayValue: formatMass(tile.uranium),
        },
        {
            name: "Climate risk",
            value: tile.climate_risk,
            maxValue: maxValues[6],
            color: `hsl(${resourceColors[6]}, 95%, 50%)`,
            displayValue: `${tile.climate_risk} / 10`,
        },
    ];

    return (
        <div
            className="absolute pointer-events-none"
            style={{
                left: `calc(50% + ${tooltipX}px)`,
                top: `calc(50% + ${tooltipY}px)`,
                width: `${TOOLTIP_WIDTH}px`,
            }}
        >
            <div className="bg-card border border-border p-4 rounded shadow-lg">
                {/* Title */}
                <div className="text-center text-xl mb-3">
                    {username ? (
                        <span className="text-foreground">{username}</span>
                    ) : (
                        <span className="text-brand-green dark:text-gray-100">
                            Vacant tile
                        </span>
                    )}
                </div>

                {/* Resources */}
                <div className="space-y-2">
                    {resources.map((resource) => {
                        const barWidth =
                            (resource.value / resource.maxValue) * 180;
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
                                            width: `${barWidth}px`,
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

/** Format mass in tons with thousands separator */
function formatMass(mass: number): string {
    const massInTons = mass / 1000;
    return `${massInTons.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")} tons`;
}
