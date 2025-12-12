/** Map page - displays hexagonal map with player territories and resources. */

import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { useState, useMemo } from "react";

import { GameLayout } from "@/components/layout/GameLayout";
import { HexTile } from "@/components/map/HexTile";
import { MapCanvas } from "@/components/map/MapCanvas";
import { MapTooltip } from "@/components/map/MapTooltip";
import { Modal } from "@/components/ui";
import { useMapContext } from "@/contexts/MapContext";
import { useAuth } from "@/hooks/useAuth";
import { useMap } from "@/hooks/useMap";
import { usePlayers } from "@/hooks/usePlayers";
import { getHexPosition } from "@/lib/hex-utils";

export const Route = createFileRoute("/app/community/map")({
    component: MapPage,
    staticData: {
        title: "Map",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
        },
    },
});

interface MapTile {
    id: number;
    q: number;
    r: number;
    solar: number;
    wind: number;
    hydro: number;
    coal: number;
    gas: number;
    uranium: number;
    climate_risk: number;
    player_id: number | null;
}

interface User {
    player_id?: number | null;
}

/** Map tiles component - renders all tiles and tooltips using MapContext */
interface MapTilesProps {
    mapData: MapTile[];
    playerMap: Record<number, string>;
    user: User | null | undefined;
    calculateDistance: (tileId: number) => number;
}

function calculatePlayerTileFill(
    tile: MapTile,
    currentPlayerId: number | null | undefined,
): string {
    if (
        currentPlayerId !== null &&
        currentPlayerId !== undefined &&
        tile.player_id === currentPlayerId
    ) {
        return "var(--map-tile-current-player)";
    } else if (tile.player_id) {
        return "var(--map-tile-other-player)";
    } else {
        return "var(--map-tile-vacant)";
    }
}

function MapTiles({
    mapData,
    playerMap,
    user,
    calculateDistance,
}: MapTilesProps) {
    const { width, height, s, w, hoveredTile } = useMapContext();

    const hoveredTilePosition = hoveredTile
        ? getHexPosition(hoveredTile.q, hoveredTile.r, s, w)
        : null;

    return (
        <>
            {mapData.map((tile) => {
                const fill = calculatePlayerTileFill(tile, user?.player_id);
                const username = tile.player_id
                    ? playerMap[tile.player_id]
                    : undefined;
                const label = username ? username.slice(0, 3) : null;

                return (
                    <HexTile
                        key={tile.id}
                        tile={tile}
                        fill={fill}
                        label={label}
                        labelFill="white"
                        onClick={() => {
                            if (tile.player_id === user?.player_id) {
                                window.location.href = "/profile";
                            } else if (tile.player_id) {
                                window.location.href = `/profile?player_id=${tile.player_id}`;
                            }
                        }}
                    />
                );
            })}

            {/* Tooltip - rendered within SVG context */}
            {hoveredTile && hoveredTilePosition && (
                <foreignObject
                    x={hoveredTilePosition.x + 40}
                    y={hoveredTilePosition.y - 40}
                    width="1"
                    height="1"
                    overflow="visible"
                >
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
                        viewportWidth={width}
                        viewportHeight={height}
                    />
                </foreignObject>
            )}
        </>
    );
}

function MapPage() {
    return (
        <GameLayout>
            <MapContent />
        </GameLayout>
    );
}

function MapContent() {
    const [showInfoPopup, setShowInfoPopup] = useState(false);

    const { data: mapData, isLoading: isMapLoading } = useMap();
    const { data: playersData, isLoading: isPlayersLoading } = usePlayers();
    const { user } = useAuth();

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
                {/* <div className="relative w-full max-w-5xl"> */}
                <div className="w-full relative pt-[86.60%]">
                    <MapCanvas className="absolute inset-0" mapData={mapData}>
                        <MapTiles
                            mapData={mapData}
                            playerMap={playerMap}
                            user={user}
                            calculateDistance={calculateDistance}
                        />
                    </MapCanvas>
                </div>
            </div>
        </div>
    );
}
