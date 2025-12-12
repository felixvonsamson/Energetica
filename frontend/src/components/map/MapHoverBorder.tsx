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
    enableAnimations?: boolean;
}

export function MapHoverBorder({
    tile,
    strokeWidth = 2,
    enableAnimations: enableTransformAnimations = true,
}: MapHoverBorderProps) {
    const { s, w } = useMapContext();
    // Keep track of the last valid tile position for smooth animations
    const [lastPosition, setLastPosition] = useState<{
        q: number;
        r: number;
    } | null>(null);

    useEffect(() => {
        if (tile) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLastPosition({ q: tile.q, r: tile.r });
        } else if (lastPosition) {
            setLastPosition({
                q: lastPosition.q,
                r: lastPosition.r,
            });
            (async () => {
                const sleep = async (milliseconds: number) => {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve("");
                        }, milliseconds);
                    });
                };
                await sleep(200);
                setLastPosition(null);
            })();
        }
    }, [tile, lastPosition]);

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
