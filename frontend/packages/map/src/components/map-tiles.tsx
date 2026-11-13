/**
 * MapTiles - shared tile-loop component used by both the community map and the
 * settlement page. Renders one HexTile per map entry with resource-overlay
 * colouring and contrast-safe labels.
 *
 * Props:
 *
 * - CurrentPlayerId highlight the current player's tile; omit on pages where the
 *   player has no tile yet (e.g. the settle page)
 * - OnTileClick make tiles clickable; omit for read-only maps
 */

import { useTheme } from "@energetica/ui/contexts/theme-context";

import { HexTile } from "#map/components/hex-tile";
import { useMapContext } from "#map/contexts/map-context";
import {
    ResourceId,
    calculateTileFillWithResource,
    calculateTileLabel,
} from "#map/lib/map-resources";
import type { MapTile } from "#map/lib/map-tile";

interface MapTilesProps {
    mapData: MapTile[];
    playerMap: Record<number, string>;
    activeResourceId: ResourceId | undefined;
    currentPlayerId?: number | null;
    onTileClick?: (tile: MapTile) => void;
}

export function MapTiles({
    mapData,
    playerMap,
    activeResourceId,
    currentPlayerId,
    onTileClick,
}: MapTilesProps) {
    const { s } = useMapContext();
    const { theme } = useTheme();

    return (
        <>
            {mapData.map((tile) => {
                let defaultFill: string;
                if (currentPlayerId && tile.player_id === currentPlayerId) {
                    defaultFill = "var(--map-tile-current-player)";
                } else if (tile.player_id) {
                    defaultFill = "var(--map-tile-other-player)";
                } else {
                    defaultFill = "var(--map-tile-vacant)";
                }
                const defaultLabelColor = tile.player_id ? "white" : "black";

                const { fill, labelColor } = calculateTileFillWithResource(
                    tile,
                    activeResourceId,
                    theme,
                    defaultFill,
                    defaultLabelColor,
                );
                const { label, size } = calculateTileLabel(
                    tile,
                    activeResourceId,
                    s,
                    playerMap,
                );

                return (
                    <HexTile
                        key={tile.id}
                        tile={tile}
                        fill={fill}
                        label={label}
                        labelSize={size}
                        labelFill={labelColor}
                        onClick={
                            onTileClick ? () => onTileClick(tile) : undefined
                        }
                    />
                );
            })}
        </>
    );
}
