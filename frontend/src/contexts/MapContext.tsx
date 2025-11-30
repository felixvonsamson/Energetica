import { createContext, useContext, type ReactNode } from "react";

/**
 * Map context providing dimensions, hex sizing, and hover state to all
 * descendants
 */
export interface MapContextValue {
    /** Canvas width in pixels */
    width: number;
    /** Canvas height in pixels */
    height: number;
    /** Hexagon size parameter (distance from center to vertex) */
    s: number;
    /** Hexagon width parameter (s * sqrt(3)) */
    w: number;
    /** ID of currently hovered tile, or null if none */
    hoveredTileId: number | null;
    /** Currently hovered tile, or null if none */
    hoveredTile: HexTileOut | null;
    /** Handler to call when mouse enters a tile */
    handleMouseEnter: (tileId: number) => void;
    /** Handler to call when mouse leaves a tile */
    handleMouseLeave: () => void;
}
export const MapContext = createContext<MapContextValue | null>(null);

/**
 * Hook to access map dimensions and hex sizing from any descendant of
 * MapCanvas.
 *
 * @throws Error if used outside of MapCanvas
 */

export function useMapContext(): MapContextValue {
    const context = useContext(MapContext);
    if (!context) {
        throw new Error(
            "useMapContext must be used within a MapCanvas component",
        );
    }
    return context;
}
export interface MapCanvasProps {
    children: ReactNode;
    className?: string;
    mapData?: Array<HexTileOut>;
}
