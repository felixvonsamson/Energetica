/** Map page - displays hexagonal map with player territories and resources. */

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { GameLayout } from "@/components/layout/game-layout";
import { MapCanvas } from "@/components/map/map-canvas";
import { MapTiles } from "@/components/map/map-tiles";
import { MapTooltip } from "@/components/map/map-tooltip";
import { ResourceButton } from "@/components/map/resource-button";
import { useMapContext } from "@/contexts/map-context";
import { useAuth } from "@/hooks/use-auth";
import { useMap } from "@/hooks/use-map";
import { usePlayers } from "@/hooks/use-players";
import { getHexPosition } from "@/lib/hex-utils";
import { RESOURCES, ResourceId } from "@/lib/map-resources";

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
        infoDialog: {
            contents: <MapHelp />,
        },
    },
});

/** Renders the hovered-tile tooltip; must be inside a MapCanvas (uses context). */
function MapTooltipLayer({
    playerMap,
    calculateDistance,
}: {
    playerMap: Record<number, string>;
    calculateDistance: (tileId: number) => number;
}) {
    const { width, height, s, w, hoveredTile } = useMapContext();
    if (!hoveredTile) return null;
    const { x, y } = getHexPosition(hoveredTile.q, hoveredTile.r, s, w);
    return (
        <foreignObject x={0} y={0} width="1" height="1" overflow="visible">
            <MapTooltip
                tile={hoveredTile}
                username={
                    hoveredTile.player_id
                        ? (playerMap[hoveredTile.player_id] ?? null)
                        : null
                }
                distance={calculateDistance(hoveredTile.id)}
                x={x}
                y={y}
                viewportWidth={width}
                viewportHeight={height}
            />
        </foreignObject>
    );
}

function MapContent() {
    const [activeResourceId, setActiveResourceId] = useState<
        ResourceId | undefined
    >(undefined);

    const { data: mapData, isLoading: isMapLoading } = useMap();
    const { data: playersData, isLoading: isPlayersLoading } = usePlayers();
    const { user } = useAuth();

    const playerMap = useMemo(() => {
        const map: Record<number, string> = {};
        playersData?.forEach((p) => { map[p.id] = p.username; });
        return map;
    }, [playersData]);

    const currentPlayerTile = useMemo(
        () => mapData?.find((t) => t.player_id === user?.player_id) ?? null,
        [mapData, user],
    );

    const calculateDistance = (tileId: number): number => {
        if (!mapData || !currentPlayerTile) return 0;
        const tile = mapData.find((t) => t.id === tileId);
        if (!tile) return 0;
        const dq = tile.q - currentPlayerTile.q;
        const dr = tile.r - currentPlayerTile.r;
        return Math.sqrt(dq * dq + dr * dr + dq * dr);
    };

    const handleResourceButtonClick = (resourceId: ResourceId) => {
        setActiveResourceId((prev) =>
            prev === resourceId ? undefined : resourceId,
        );
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
                <div className="w-full relative pt-[86.60%] lg:pt-0 lg:flex-1 lg:h-full">
                    <MapCanvas className="absolute inset-0" mapData={mapData}>
                        <MapTiles
                            mapData={mapData}
                            playerMap={playerMap}
                            activeResourceId={activeResourceId}
                            currentPlayerId={user?.player_id}
                        />
                        <MapTooltipLayer
                            playerMap={playerMap}
                            calculateDistance={calculateDistance}
                        />
                    </MapCanvas>
                </div>
            </div>
        </div>
    );
}

function MapPage() {
    return (
        <GameLayout>
            <MapContent />
        </GameLayout>
    );
}
