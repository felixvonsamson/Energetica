/**
 * MapHoverBorder component - renders a stroke overlay for the hovered tile.
 *
 * This component provides visual feedback when a user hovers over a hex tile by
 * rendering a coloured border around it.
 */

import { useState, useEffect } from "react";

import { useMapContext } from "@/contexts/map-context";
import { getHexPosition } from "@/lib/hex-utils";

interface MapHoverBorderProps {
    tile: { q: number; r: number } | null;
    strokeWidth?: number;
    enableAnimations?: boolean;
}

export function MapHoverBorder({
    tile,
    strokeWidth = 2,
    enableAnimations: enableTransformAnimations = true,
}: MapHoverBorderProps) {
    const { s, w } = useMapContext();

    // Track the last known position; updated during render using the
    // "derived state from props" pattern (react.dev/learn/you-might-not-need-an-effect)
    const [lastPosition, setLastPosition] = useState<{
        q: number;
        r: number;
    } | null>(null);
    const [prevTile, setPrevTile] = useState(tile);

    if (prevTile !== tile) {
        setPrevTile(tile);
        if (tile) {
            setLastPosition({ q: tile.q, r: tile.r });
        }
    }

    // When tile is removed, keep the border visible for 200ms then hide it
    useEffect(() => {
        if (!tile) {
            const timer = setTimeout(() => setLastPosition(null), 200);
            return () => clearTimeout(timer);
        }
    }, [tile]);

    if (!lastPosition) return null;

    const { x: tx, y: ty } = getHexPosition(lastPosition.q, lastPosition.r, s, w);

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
            style={{ transform: `translate(${tx}px, ${ty}px)` }}
            className={
                enableTransformAnimations
                    ? "transition-transform duration-200 ease-in-out"
                    : ""
            }
        >
            <polygon
                points={points}
                className="transition-all duration-150"
                fill="none"
                stroke="var(--map-selected-tile-hover)"
                strokeWidth={tile !== null ? strokeWidth : 0}
                pointerEvents="none"
            />
        </g>
    );
}
