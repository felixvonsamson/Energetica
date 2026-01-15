/** Map page - displays hexagonal map with player territories and resources. */

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { GameLayout } from "@/components/layout/game-layout";
import { HexTile } from "@/components/map/hex-tile";
import { MapCanvas } from "@/components/map/map-canvas";
import { MapTooltip } from "@/components/map/map-tooltip";
import { ResourceButton } from "@/components/map/resource-button";
import { useMapContext } from "@/contexts/map-context";
import { useTheme } from "@/contexts/theme-context";
import { useAuth } from "@/hooks/useAuth";
import { useMap } from "@/hooks/useMap";
import { usePlayers } from "@/hooks/usePlayers";
import { getHexPosition } from "@/lib/hex-utils";
import {
    RESOURCES,
    ResourceId,
    calculateTileFillWithResource,
    formatResourceValue,
} from "@/lib/map-resources";

function MapHelp() {
    return (
        <div className="space-y-3">
            <p>
                On this page you can see the map and the other players on the
                server.
            </p>
            <p>
                If you click on the tile of a player you will see their profile.
            </p>
            <p>
                For more detailed information about the map and the resources
                you can find on it refer to the Map section in the wiki.
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/community/map")({
    component: MapPage,
    staticData: {
        title: "Map",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
        },
        infoModal: {
            contents: <MapHelp />,
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
    activeResourceId: ResourceId | undefined;
}

function MapTiles({
    mapData,
    playerMap,
    user,
    calculateDistance,
    activeResourceId,
}: MapTilesProps) {
    const { width, height, s, w, hoveredTile } = useMapContext();
    const { theme } = useTheme();

    const hoveredTilePosition = hoveredTile
        ? getHexPosition(hoveredTile.q, hoveredTile.r, s, w)
        : null;

    return (
        <>
            {mapData.map((tile) => {
                // Determine default fill based on player territories
                let defaultFill: string;
                if (
                    user?.player_id !== null &&
                    user?.player_id !== undefined &&
                    tile.player_id === user.player_id
                ) {
                    defaultFill = "var(--map-tile-current-player)";
                } else if (tile.player_id) {
                    defaultFill = "var(--map-tile-other-player)";
                } else {
                    defaultFill = "var(--map-tile-vacant)";
                }

                const fill = calculateTileFillWithResource(
                    tile,
                    activeResourceId,
                    theme,
                    defaultFill,
                );

                // Determine label based on mode
                let label: string | null = null;
                let labelSize = 20;
                let labelFill = "white";

                if (activeResourceId !== undefined) {
                    // Show resource values when a resource is selected
                    label = formatResourceValue(tile, activeResourceId);
                    labelSize = Math.max(10, s / 4);
                    labelFill = "black";
                } else if (tile.player_id) {
                    // Show player initials in normal mode
                    const username = playerMap[tile.player_id];
                    label = username ? username.slice(0, 3) : null;
                    labelFill = "white";
                }

                return (
                    <HexTile
                        key={tile.id}
                        tile={tile}
                        fill={fill}
                        label={label}
                        labelSize={labelSize}
                        labelFill={labelFill}
                    />
                );
            })}

            {/* Tooltip - rendered within SVG context */}
            {hoveredTile && hoveredTilePosition && (
                <foreignObject
                    x={0}
                    y={0}
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
    const [activeResourceId, setActiveResourceId] = useState<
        ResourceId | undefined
    >(undefined);

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

    const handleResourceButtonClick = (resourceId: ResourceId) => {
        if (activeResourceId === resourceId) {
            setActiveResourceId(undefined);
        } else {
            setActiveResourceId(resourceId);
        }
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
        <div className="p-4 flex flex-col h-full">
            <div className="flex flex-col lg:flex-row gap-4 lg:flex-1 lg:min-h-0">
                {/* Left sidebar - Resource filters */}
                <div className="grid grid-cols-3 md:grid-cols-7 lg:grid-cols-1 gap-2 lg:w-32 lg:shrink-0 lg:self-center">
                    {RESOURCES.map((resource) => (
                        <ResourceButton
                            key={resource.id}
                            resource={resource}
                            isActive={activeResourceId === resource.id}
                            onClick={() =>
                                handleResourceButtonClick(resource.id)
                            }
                        />
                    ))}
                </div>

                {/* Map */}
                {/* Using padding-based aspect ratio for Safari compatibility on mobile */}
                <div className="w-full relative pt-[86.60%] lg:pt-0 lg:flex-1 lg:h-full">
                    <MapCanvas className="absolute inset-0" mapData={mapData}>
                        <MapTiles
                            mapData={mapData}
                            playerMap={playerMap}
                            user={user}
                            calculateDistance={calculateDistance}
                            activeResourceId={activeResourceId}
                        />
                    </MapCanvas>
                </div>
            </div>
        </div>
    );
}
