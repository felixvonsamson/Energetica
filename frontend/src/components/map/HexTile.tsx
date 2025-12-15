/**
 * HexTile component - renders a single hexagonal tile on the map. Uses SVG
 * polygon for rendering with axial coordinates (q, r).
 *
 * A presentational component that accepts styling props. Parents are
 * responsible for calculating colors and labels based on their specific needs.
 */

//TODO: HexTile should not change the mouse icon, as if it were a link, if there is no link

import { useMapContext } from "@/contexts/MapContext";
import { getHexagonPoints, getHexPosition } from "@/lib/hex-utils";
import { HexTileResources } from "@/types/map";

export interface HexTileProps {
    tile: HexTileResources;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    label?: string | null;
    labelSize?: number;
    labelFill?: string;
    onClick?: () => void;
}

export function HexTile({
    tile,
    fill = "hsl(45, 21%, 35%)",
    stroke = "rgba(0, 0, 0, 0.3)",
    strokeWidth = 1,
    label = null,
    labelSize = 20,
    labelFill = "white",
    onClick,
}: HexTileProps) {
    const { s, w, handleMouseEnter, handleMouseLeave } = useMapContext();

    // Calculate hexagon center position using axial coordinates
    const { x: tx, y: ty } = getHexPosition(tile.q, tile.r, s, w);

    // Get hexagon vertices
    const points = getHexagonPoints(s, w);

    return (
        <g
            transform={`translate(${tx}, ${ty})`}
            onMouseEnter={() => handleMouseEnter(tile.id)}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
            className="cursor-pointer"
        >
            <polygon
                points={points}
                className="transition-color duration-150"
                style={{
                    fill,
                    stroke,
                    strokeWidth,
                }}
            />
            {label && (
                <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={labelFill}
                    fontSize={labelSize}
                    fontFamily="inherit"
                >
                    {label}
                </text>
            )}
        </g>
    );
}
