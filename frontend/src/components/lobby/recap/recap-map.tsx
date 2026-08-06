/**
 * The recap's frozen map snapshot. No `MapContext` provider of its own — it
 * hands the frozen `RecapTile[]` (adapted to the live `HexTileOut` shape) to
 * the _same_ `MapCanvas`/`MapTiles` the in-game community map renders with, so
 * the snapshot isn't a lookalike reimplementation but the actual map component
 * displaying old data. That also fixes the recap map's sizing: it previously
 * hard-coded a 14px hex (`recap-map.tsx` pre-#915) instead of
 * `calculateHexSizeWithConstraints`, so it never matched the live map's scale.
 *
 * With no resource selected it shows the world as it was — settled tiles
 * (labelled with the owner) against vacant land. The `ResourceButton` row (the
 * same control as the in-game community map) swaps in a per-resource
 * potential/reserve heatmap; clicking the active resource toggles back to the
 * territory view. Extraction/depletion is deliberately absent: the frozen tiles
 * carry only remaining reserves, not the original, so a true "what was pulled
 * from here" map needs a newly minted metric (parked — see #864 discussion).
 *
 * Hovering a tile shows the same info panel as the in-game map (owner, or
 * "Vacant tile", plus every resource's level) via `RecapMapTooltip` — a
 * recap-specific shell (no "Distance", no activity dot — neither applies to a
 * frozen photograph with no current player) built on the same
 * `buildResourceBars`/`calculateTooltipPosition` helpers `MapTooltip` uses, so
 * the numbers can't drift between the two.
 */

import { useMemo, useState } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import { MapTiles } from "@/components/map/map-tiles";
import { ResourceButton } from "@/components/map/resource-button";
import { useMapContext } from "@/contexts/map-context";
import { getHexPosition } from "@/lib/hex-utils";
import { RESOURCES, ResourceId } from "@/lib/map-resources";
import type { RecapTile } from "@/lib/recap";
import type { HexTileResources } from "@/types/map";

import { RecapMapTooltip } from "./recap-map-tooltip";

type Props = {
    tiles: RecapTile[];
    /** Account_id → username at freeze, for the settled-tile labels. */
    ownerNames: Record<number, string>;
};

export function RecapMap({ tiles, ownerNames }: Props) {
    const [overlay, setOverlay] = useState<ResourceId | undefined>(undefined);

    // MapTiles/HexTile expect the live HexTileOut shape: a numeric `id` (used
    // only as the React key + hover lookup here, never round-tripped anywhere)
    // and `player_id` in place of the recap's durable `owner_account_id`. The
    // index is stable — `tiles` is a fixed prop, not a live-updating list.
    const mapData: HexTileResources[] = useMemo(
        () =>
            tiles.map((tile, index) => ({
                ...tile,
                id: index,
                player_id: tile.owner_account_id,
            })),
        [tiles],
    );

    const toggleOverlay = (id: ResourceId) =>
        setOverlay((current) => (current === id ? undefined : id));

    if (tiles.length === 0) {
        return (
            <p className="text-muted-foreground text-sm">
                No map data for this recap.
            </p>
        );
    }

    return (
        <div>
            <div className="mb-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {RESOURCES.map((resource) => (
                    <ResourceButton
                        key={resource.id}
                        resource={resource}
                        isActive={overlay === resource.id}
                        onClick={() => toggleOverlay(resource.id)}
                    />
                ))}
            </div>
            {/* Fixed aspect-ratio box (same ratio as the settle/community-map
                pages): MapCanvas measures its container and sizes hexes to fit,
                so this keeps the frozen snapshot at the live map's scale
                instead of a hard-coded pixel size. */}
            <div className="w-full relative pt-[86.60%]">
                <MapCanvas className="absolute inset-0" mapData={mapData}>
                    <MapTiles
                        mapData={mapData}
                        playerMap={ownerNames}
                        activeResourceId={overlay}
                    />
                    <RecapMapTooltipLayer ownerNames={ownerNames} />
                </MapCanvas>
            </div>
        </div>
    );
}

/**
 * Renders the hovered-tile info panel; must be inside a MapCanvas (uses
 * context).
 */
function RecapMapTooltipLayer({
    ownerNames,
}: {
    ownerNames: Record<number, string>;
}) {
    const { width, height, s, w, hoveredTile } = useMapContext();
    if (!hoveredTile) return null;
    const { x, y } = getHexPosition(hoveredTile.q, hoveredTile.r, s, w);
    return (
        <foreignObject
            x={-width / 2}
            y={-height / 2}
            width={width}
            height={height}
            overflow="visible"
            style={{ pointerEvents: "none" }}
        >
            <RecapMapTooltip
                tile={hoveredTile}
                ownerName={
                    hoveredTile.player_id
                        ? (ownerNames[hoveredTile.player_id] ?? null)
                        : null
                }
                x={x}
                y={y}
                viewportWidth={width}
                viewportHeight={height}
            />
        </foreignObject>
    );
}
