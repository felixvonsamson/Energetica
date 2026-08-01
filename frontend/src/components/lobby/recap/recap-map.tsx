/**
 * The recap's frozen map snapshot. A self-contained SVG hex map: no
 * `MapContext`, no live game data — just the `RecapTile[]` frozen at freeze
 * (T5/G1). It reuses the pure geometry (`hex-utils`) and the resource-heatmap
 * colouring (`map-resources`) the in-game map already uses, so the snapshot
 * mimics the live view and the world survives instance teardown.
 *
 * With no resource selected it shows the world as it was — settled tiles
 * (labelled with the owner) against vacant land and rivers (hydro potential).
 * The `ResourceButton` row (the same control as the in-game community map)
 * swaps in a per-resource potential/reserve heatmap; clicking the active
 * resource toggles back to the territory view. Extraction/depletion is
 * deliberately absent: the frozen tiles carry only remaining reserves, not the
 * original, so a true "what was pulled from here" map needs a newly minted
 * metric (parked — see #864 discussion).
 */

import { useMemo, useState } from "react";

import { ResourceButton } from "@/components/map/resource-button";
import { useTheme } from "@/contexts/theme-context";
import { getHexPosition, getHexagonPoints } from "@/lib/hex-utils";
import {
    RESOURCES,
    ResourceId,
    calculateTileFillWithResource,
} from "@/lib/map-resources";
import type { RecapTile } from "@/lib/recap";

const S = 14; // hex size (centre → vertex)
const W = S * Math.sqrt(3);

type Props = {
    tiles: RecapTile[];
    /** Account_id → username at freeze, for the settled-tile labels. */
    ownerNames: Record<number, string>;
    /** When set, the tile owned by this account is outlined (table↔map echo). */
    highlightAccountId?: number | null;
    onHoverOwner?: (accountId: number | null) => void;
};

export function RecapMap({
    tiles,
    ownerNames,
    highlightAccountId,
    onHoverOwner,
}: Props) {
    const { theme } = useTheme();
    const [overlay, setOverlay] = useState<ResourceId | undefined>(undefined);

    const { points, viewBox } = useMemo(() => {
        const placed = tiles.map((tile) => {
            const { x, y } = getHexPosition(tile.q, tile.r, S, W);
            return { tile, x, y };
        });
        const xs = placed.map((p) => p.x);
        const ys = placed.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const pad = S * 2;
        return {
            points: placed,
            viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${
                maxY - minY + 2 * pad
            }`,
        };
    }, [tiles]);

    const hexPoints = getHexagonPoints(S, W);

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
            <svg
                viewBox={viewBox}
                className="w-full"
                style={{ maxHeight: "70vh" }}
            >
                {points.map(({ tile, x, y }) => {
                    const owned = tile.owner_account_id != null;
                    const isRiver = tile.hydro > 0;
                    const base = owned
                        ? "var(--map-tile-other-player, oklch(0.55 0.02 250))"
                        : isRiver
                          ? "oklch(0.86 0.05 230)"
                          : "var(--map-tile-vacant, oklch(0.92 0.005 90))";
                    const { fill, labelColor } = calculateTileFillWithResource(
                        { ...tile, player_id: tile.owner_account_id },
                        overlay,
                        theme,
                        base,
                        owned ? "white" : "black",
                    );
                    const highlighted =
                        highlightAccountId != null &&
                        tile.owner_account_id === highlightAccountId;
                    const name =
                        tile.owner_account_id != null
                            ? ownerNames[tile.owner_account_id]
                            : undefined;
                    return (
                        <g
                            key={`${tile.q},${tile.r}`}
                            transform={`translate(${x}, ${y})`}
                            onMouseEnter={() =>
                                onHoverOwner?.(tile.owner_account_id)
                            }
                            onMouseLeave={() => onHoverOwner?.(null)}
                        >
                            <polygon
                                points={hexPoints}
                                style={{
                                    fill,
                                    stroke: highlighted
                                        ? "var(--foreground, #000)"
                                        : "rgba(0,0,0,0.18)",
                                    strokeWidth: highlighted ? 2.5 : 1,
                                }}
                            />
                            {owned && (
                                <text
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={7}
                                    fill={labelColor}
                                >
                                    {/* 3 chars, centred on the tile — matches the in-game map's owner-label convention (map-resources.ts, calculateTileLabel). */}
                                    {name?.slice(0, 3)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
