/**
 * THROWAWAY PROTOTYPE — recap map snapshot, issue #864 (T6).
 *
 * A self-contained SVG hex map for the recap: no `MapContext`, no game data —
 * just the frozen `RecapTile[]`. Reuses the pure geometry (`hex-utils`) and the
 * resource heatmap colouring (`map-resources`) the in-game map already uses, so
 * the snapshot mimics the live view. Renders the world as it was: settled vs
 * vacant tiles, rivers (hydro potential), and an optional resource overlay.
 */

import { useMemo, useState } from "react";

import { useTheme } from "@/contexts/theme-context";
import { getHexPosition, getHexagonPoints } from "@/lib/hex-utils";
import {
    RESOURCES,
    ResourceId,
    calculateTileFillWithResource,
} from "@/lib/map-resources";

import type { RecapTile } from "./mock";

type Props = {
    tiles: RecapTile[];
    ownerNames: Record<number, string>;
    /** Account_id → tile-fill colour, so the map can echo the table selection */
    highlightAccountId?: number | null;
    onHoverOwner?: (accountId: number | null) => void;
    className?: string;
};

const S = 14; // hex size (centre → vertex)
const W = S * Math.sqrt(3);

export function RecapMap({
    tiles,
    ownerNames,
    highlightAccountId,
    onHoverOwner,
    className,
}: Props) {
    const { theme } = useTheme();
    const [overlay, setOverlay] = useState<ResourceId | undefined>(undefined);

    const { points, viewBox } = useMemo(() => {
        const points = tiles.map((t) => {
            const { x, y } = getHexPosition(t.q, t.r, S, W);
            return { t, x, y };
        });
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const pad = S * 2;
        return {
            points,
            viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${
                maxY - minY + 2 * pad
            }`,
        };
    }, [tiles]);

    const hexPts = getHexagonPoints(S, W);

    return (
        <div className={className}>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <button
                    onClick={() => setOverlay(undefined)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        overlay === undefined
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                >
                    Territory
                </button>
                {RESOURCES.map((res) => (
                    <button
                        key={res.id}
                        onClick={() => setOverlay(res.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            overlay === res.id
                                ? "border-foreground bg-foreground text-background"
                                : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                    >
                        {res.name}
                    </button>
                ))}
            </div>
            <svg
                viewBox={viewBox}
                className="w-full"
                style={{ maxHeight: "70vh" }}
            >
                {points.map(({ t, x, y }) => {
                    const owned = t.owner_account_id != null;
                    const isRiver = t.hydro > 0;
                    // territory base: settled tiles read as "lived in"
                    const base = owned
                        ? "var(--map-tile-other-player, oklch(0.55 0.02 250))"
                        : isRiver
                          ? "oklch(0.86 0.05 230)"
                          : "var(--map-tile-vacant, oklch(0.92 0.005 90))";
                    const { fill } = calculateTileFillWithResource(
                        { ...t, player_id: t.owner_account_id },
                        overlay,
                        theme,
                        base,
                        "black",
                    );
                    const highlighted =
                        highlightAccountId != null &&
                        t.owner_account_id === highlightAccountId;
                    const name =
                        t.owner_account_id != null
                            ? ownerNames[t.owner_account_id]
                            : undefined;
                    return (
                        <g
                            key={`${t.q},${t.r}`}
                            transform={`translate(${x}, ${y})`}
                            onMouseEnter={() =>
                                onHoverOwner?.(t.owner_account_id)
                            }
                            onMouseLeave={() => onHoverOwner?.(null)}
                            className={owned ? "cursor-default" : ""}
                        >
                            <polygon
                                points={hexPts}
                                style={{
                                    fill,
                                    stroke: highlighted
                                        ? "var(--foreground, #000)"
                                        : "rgba(0,0,0,0.18)",
                                    strokeWidth: highlighted ? 2.5 : 1,
                                }}
                            />
                            {owned && overlay === undefined && (
                                <>
                                    <circle r={3} fill="white" />
                                    <text
                                        y={S * 0.9}
                                        textAnchor="middle"
                                        fontSize={7}
                                        fill="var(--foreground, #111)"
                                    >
                                        {name?.slice(0, 6)}
                                    </text>
                                </>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
