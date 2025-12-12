/**
 * MapCanvas component - provides the SVG container and coordinate system for
 * hexagonal map rendering. Automatically sizes to fit its container using CSS.
 *
 * Provides map dimensions and hex sizing through React Context, so child
 * components (like HexTile) can access s, w, and other sizing parameters
 * without prop drilling.
 */

import { useRef, useState, useCallback, useMemo } from "react";

import { MapHoverBorder } from "./MapHoverBorder";

import {
    MapCanvasProps,
    MapContextValue,
    MapContext,
} from "@/contexts/MapContext";
import { useContainerDimensions } from "@/hooks/useContainerDimensions";
import { calculateHexSizeWithConstraints } from "@/lib/hex-utils";

/**
 * MapCanvas component that automatically sizes to its container and provides
 * hex sizing calculations and hover state management to descendants via React
 * Context.
 */
export function MapCanvas({ children, className, mapData }: MapCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { width, height } = useContainerDimensions(containerRef);

    // Hover state management
    const [hoveredTileId, setHoveredTileId] = useState<number | null>(null);

    const handleMouseEnter = useCallback((tileId: number) => {
        setHoveredTileId(tileId);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setHoveredTileId(null);
    }, []);

    // Derive hovered tile from mapData
    const hoveredTile = useMemo(() => {
        if (hoveredTileId === null || !mapData) return null;
        return mapData.find((t) => t.id === hoveredTileId) ?? null;
    }, [hoveredTileId, mapData]);

    // Calculate hex size based on container dimensions
    // Need to consider both width AND height constraints
    const { s, w } =
        width > 0 && height > 0
            ? calculateHexSizeWithConstraints(width, height)
            : { s: 0, w: 0 };

    const contextValue: MapContextValue = {
        width,
        height,
        s,
        w,
        hoveredTileId,
        hoveredTile,
        handleMouseEnter,
        handleMouseLeave,
    };

    return (
        <div ref={containerRef} className={className}>
            {width > 0 && height > 0 && (
                <MapContext.Provider value={contextValue}>
                    {/* testing: className="bg-gray-100" */}
                    <svg width={width} height={height}>
                        <g transform={`translate(${width / 2}, ${height / 2})`}>
                            {children}
                            {/* Render hover border on top of all tiles */}
                            {hoveredTile && (
                                <MapHoverBorder
                                    tile={hoveredTile}
                                    enableAnimations={false}
                                />
                            )}
                        </g>
                    </svg>
                </MapContext.Provider>
            )}
        </div>
    );
}
