/**
 * MapHoverBorder component - renders a stroke overlay for the hovered tile.
 *
 * This component provides visual feedback when a user hovers over a hex tile by
 * rendering a coloured border around it.
 */

import { useState, useEffect } from "react";
import { useMapContext } from "@/contexts/MapContext";
import { getHexPosition } from "@/lib/hex-utils";

interface MapHoverBorderProps {
    tile: { q: number; r: number } | null;
    strokeWidth?: number;
    show?: boolean;
}

export function MapHoverBorder({ tile, strokeWidth = 2 }: MapHoverBorderProps) {
    const { s, w } = useMapContext();
    // Keep track of the last valid tile position for smooth animations
    const [lastPosition, setLastPosition] = useState<{
        q: number;
        r: number;
        show: boolean;
    } | null>(null);

    useEffect(() => {
        if (tile) {
            setLastPosition({ q: tile.q, r: tile.r, show: true });
        } else if (lastPosition) {
            setLastPosition({
                q: lastPosition.q,
                r: lastPosition.r,
                show: false,
            });
        }
    }, [tile]);

    if (!lastPosition) return null;

    const { x: tx, y: ty } = getHexPosition(
        lastPosition.q,
        lastPosition.r,
        s,
        w,
    );

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
                    transform: lastPosition.show ? "scale(1)" : "scale(0)",
                    transformOrigin: "center",
                }}
            >
                <polygon
                    points={points}
                    className="transition-all duration-150"
                    fill="none"
                    stroke="var(--map-selected-tile-hover)"
                    strokeWidth={lastPosition.show ? strokeWidth : 0}
                    pointerEvents="none"
                />
            </g>
        </g>
    );
}
