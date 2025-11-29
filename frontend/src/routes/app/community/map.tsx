/** Map page - displays hexagonal map with player territories and resources. */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { HelpCircle } from "lucide-react";

import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout/GameLayout";
import { Modal } from "@/components/ui";
import { HexTile } from "@/components/map/HexTile";
import { MapTooltip } from "@/components/map/MapTooltip";
import { useMap } from "@/hooks/useMap";
import { usePlayers } from "@/hooks/usePlayers";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/app/community/map")({
    component: MapPage,
    staticData: {
        title: "Map",
    },
});

/** Hover border component - renders a stroke overlay for hovered tiles */
interface HoverBorderProps {
    tile: { q: number; r: number };
    s: number;
    w: number;
}

function HoverBorder({ tile, s, w }: HoverBorderProps) {
    const tx = w * tile.q + 0.5 * w * tile.r;
    const ty = 1.5 * s * tile.r;

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
        <g transform={`translate(${tx}, ${ty})`}>
            <polygon
                points={points}
                fill="none"
                stroke="var(--map-selected-tile-hover)"
                strokeWidth="2"
                pointerEvents="none"
            />
        </g>
    );
}

function MapPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <MapContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

function MapContent() {
    const [showInfoPopup, setShowInfoPopup] = useState(false);
    const [hoveredTileId, setHoveredTileId] = useState<number | null>(null);
    const [viewportWidth, setViewportWidth] = useState(
        typeof window !== "undefined" ? window.innerWidth : 1200,
    );
    const [viewportHeight, setViewportHeight] = useState(
        typeof window !== "undefined" ? window.innerHeight : 800,
    );

    const { data: mapData, isLoading: isMapLoading } = useMap();
    const { data: playersData, isLoading: isPlayersLoading } = usePlayers();
    const { user } = useAuth();

    // Listen for window resize events
    useEffect(() => {
        const handleResize = () => {
            setViewportWidth(window.innerWidth);
            setViewportHeight(window.innerHeight);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Create a map of player IDs to usernames
    const playerMap = useMemo(() => {
        const map: Record<number, string> = {};
        if (playersData) {
            playersData.forEach((player) => {
                map[player.id] = player.username;
            });
        }
        return map;
    }, [playersData]);

    // Find current player's tile
    const currentPlayerTile = useMemo(() => {
        if (!mapData || !user?.player_id) return null;
        return mapData.find((tile) => tile.player_id === user.player_id);
    }, [mapData, user]);

    // Calculate distance from current player's tile
    const calculateDistance = (tileId: number): number => {
        if (!mapData || !currentPlayerTile) return 0;
        const tile = mapData.find((t) => t.id === tileId);
        if (!tile) return 0;

        const dq = tile.q - currentPlayerTile.q;
        const dr = tile.r - currentPlayerTile.r;
        return Math.sqrt(dq * dq + dr * dr + dq * dr);
    };

    // Calculate responsive sizing
    // Use viewport width but cap at reasonable sizes
    const canvasWidth = Math.min(
        viewportWidth < 1200 ? viewportWidth : 0.7 * viewportWidth,
        1200,
    );
    const canvasHeight = Math.min(
        viewportWidth < 1200 ? 0.86 * viewportWidth : 0.6 * viewportWidth,
        950,
    );

    const sizeParam = 10; // map size parameter from original
    const s = Math.min(280, 0.26 * canvasWidth) / sizeParam; // hexagon size
    const w = Math.sqrt(3) * s; // width parameter

    // Get hovered tile data
    const hoveredTile =
        hoveredTileId !== null && mapData
            ? mapData.find((t) => t.id === hoveredTileId)
            : null;

    // Calculate hovered tile position for tooltip
    const hoveredTilePosition = hoveredTile
        ? {
              x: w * hoveredTile.q + 0.5 * w * hoveredTile.r,
              y: 1.5 * s * hoveredTile.r,
          }
        : null;

    if (isMapLoading || isPlayersLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-lg">Loading map...</p>
            </div>
        );
    }

    if (!mapData) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-lg text-red-500">Failed to load map data</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Map
                </h1>
                <button
                    onClick={() => setShowInfoPopup(true)}
                    className="text-primary hover:opacity-80 transition-opacity"
                    aria-label="Show help"
                >
                    <HelpCircle className="w-8 h-8" />
                </button>
            </div>

            {/* Info modal */}
            <Modal
                isOpen={showInfoPopup}
                onClose={() => setShowInfoPopup(false)}
                title="Help : Map"
            >
                <div className="space-y-3">
                    <p>
                        On this page you can see the map and the other players
                        on the server.
                    </p>
                    <p>
                        If you click on the tile of a player you will see their
                        profile.
                    </p>
                    <p>
                        For more detailed information about the map and the
                        resources you can find on it refer to the Map section in
                        the wiki.
                    </p>
                </div>
            </Modal>

            {/* Map visualization */}
            <div className="flex justify-center">
                <div className="relative">
                    <svg width={canvasWidth} height={canvasHeight}>
                        <g
                            transform={`translate(${canvasWidth / 2}, ${canvasHeight / 2})`}
                        >
                            {mapData.map((tile) => (
                                <HexTile
                                    key={tile.id}
                                    tile={tile}
                                    s={s}
                                    w={w}
                                    isHovered={tile.id === hoveredTileId}
                                    isCurrentPlayer={
                                        tile.player_id === user?.player_id
                                    }
                                    username={
                                        tile.player_id
                                            ? playerMap[tile.player_id]
                                            : undefined
                                    }
                                    onMouseEnter={() =>
                                        setHoveredTileId(tile.id)
                                    }
                                    onMouseLeave={() => setHoveredTileId(null)}
                                    onClick={() => {
                                        if (
                                            tile.player_id === user?.player_id
                                        ) {
                                            window.location.href = "/profile";
                                        } else if (tile.player_id) {
                                            window.location.href = `/profile?player_id=${tile.player_id}`;
                                        }
                                    }}
                                />
                            ))}

                            {/* Render hovered tile stroke on top */}
                            {hoveredTile && (
                                <HoverBorder tile={hoveredTile} s={s} w={w} />
                            )}
                        </g>
                    </svg>

                    {/* Tooltip */}
                    {hoveredTile && hoveredTilePosition && (
                        <MapTooltip
                            tile={hoveredTile}
                            username={
                                hoveredTile.player_id
                                    ? playerMap[hoveredTile.player_id]
                                    : null
                            }
                            distance={calculateDistance(hoveredTile.id)}
                            x={hoveredTilePosition.x}
                            y={hoveredTilePosition.y}
                            viewportWidth={canvasWidth}
                            viewportHeight={canvasHeight}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
