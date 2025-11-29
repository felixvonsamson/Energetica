/**
 * HexTile component - renders a single hexagonal tile on the map. Uses SVG
 * polygon for rendering with axial coordinates (q, r).
 */

import type { ApiResponse } from "@/types/api-helpers";

type HexTileData = ApiResponse<"/api/v1/map", "get">[number];

interface HexTileProps {
    tile: HexTileData;
    s: number; // hexagon size parameter
    w: number; // width parameter (sqrt(3) * s)
    isHovered: boolean;
    isCurrentPlayer: boolean;
    username?: string;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onClick: () => void;
}

export function HexTile({
    tile,
    s,
    w,
    isHovered,
    isCurrentPlayer,
    username,
    onMouseEnter,
    onMouseLeave,
    onClick,
}: HexTileProps) {
    // Calculate hexagon center position using axial coordinates
    const tx = w * tile.q + 0.5 * w * tile.r;
    const ty = 1.5 * s * tile.r;

    // Calculate hexagon vertices (pointy-top orientation)
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

    // Determine fill color based on tile state
    // Colors are defined as CSS variables in global.css
    let fillColor: string;
    if (isCurrentPlayer) {
        fillColor = "var(--map-tile-current-player)";
    } else if (tile.player_id) {
        fillColor = "var(--map-tile-other-player)";
    } else {
        fillColor = "var(--map-tile-vacant)";
    }

    return (
        <g
            transform={`translate(${tx}, ${ty})`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
            className="cursor-pointer transition-colors duration-150"
        >
            <polygon
                points={points}
                fill={fillColor}
                stroke="rgba(0, 0, 0, 0.3)"
                strokeWidth="1"
            />
            {username && (
                <text
                    x={0}
                    y={-4}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={20}
                    fontFamily="inherit"
                >
                    {username.slice(0, 3)}
                </text>
            )}
        </g>
    );
}
