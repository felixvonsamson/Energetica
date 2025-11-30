/**
 * MapHoverBorder component - renders a stroke overlay for the hovered tile.
 *
 * This component provides visual feedback when a user hovers over a hex tile by
 * rendering a coloured border around it.
 */

import { useRef, useEffect } from "react";
import { useMapContext } from "@/contexts/MapContext";
import { getHexPosition } from "@/lib/hex-utils";

interface MapHoverBorderProps {
    tile: { q: number; r: number } | null;
    strokeWidth?: number;
    show?: boolean;
}

export function MapHoverBorder({
    tile,
    strokeWidth = 2,
    show = true,
}: MapHoverBorderProps) {
    const { s, w } = useMapContext();
    // Keep track of the last valid tile position for smooth animations
    const lastTileRef = useRef(tile);

    useEffect(() => {
        if (tile) {
            lastTileRef.current = tile;
        }
    }, [tile]);

    // Use last known position if current tile is null
    const currentTile = tile || lastTileRef.current;
    // const currentTile

    // If we've never had a tile, don't render
    if (!currentTile) {
        return null;
    }

    const { x: tx, y: ty } = getHexPosition(currentTile.q, currentTile.r, s, w);

    const points = [
        [0, s],
        [0.5 * w, 0.5 * s],
        [0.5 * w, -0.5 * s],
        [0, -s],
        [-0.5 * w, -0.5 * s],
        [-0.5 * w, 0.5 * s],
    ]
        .map(([x, y]) => `${x},${y}`)
        .join(" ");

    return (
        <g
            transform={`translate(${tx}, ${ty})`}
            className="transition-[transform] duration-200 ease-in-out"
        >
            <g
                // className="transition-transform duration-200 ease-in-out origin-center"
                style={{
                    transform: show ? "scale(1)" : "scale(0)",
                    transformOrigin: "center",
                }}
            >
                <polygon
                    points={points}
                    className="transition-all duration-150"
                    fill="none"
                    stroke="var(--map-selected-tile-hover)"
                    strokeWidth={show ? strokeWidth : 0}
                    pointerEvents="none"
                />
            </g>
        </g>
    );
}
