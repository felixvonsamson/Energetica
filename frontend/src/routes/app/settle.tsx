/** Settlement page - allows player to choose their starting location on the map. */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";

import { HexTile } from "@/components/map/hex-tile";
import { MapCanvas } from "@/components/map/map-canvas";
import { MapHoverBorder } from "@/components/map/map-hover-border";
import { ResourceButton } from "@/components/map/resource-button";
import { ThemeToggle } from "@/components/ui";
import { useMapContext } from "@/contexts/map-context";
import { useTheme } from "@/contexts/theme-context";
import { useAuth } from "@/hooks/useAuth";
import { useMap } from "@/hooks/useMap";
import { usePlayers } from "@/hooks/usePlayers";
import { mapApi } from "@/lib/api/map";
import { formatMass } from "@/lib/format-utils";
import {
    RESOURCES,
    MAX_VALUES,
    ResourceId,
    calculateTileFillWithResource,
    getResourceValue,
    formatResourceValue,
} from "@/lib/map-resources";
import type { ApiResponse } from "@/types/api-helpers";
import { HexTileResources } from "@/types/map";

type HexTileData = ApiResponse<"/api/v1/map", "get">[number];

function SettleHelp() {
    return (
        <div className="space-y-3">
            <p>
                The first decisions you have to make in the game is to choose an
                available location on the map. The menu on the left allows you
                to see where different natural resources are located.
            </p>
            <p>
                The location choice is <strong>definitive</strong>, you will not
                be able to change it during the game so choose wisely.
            </p>
            <p>
                For more detailed information about the map, the resources you
                can find on it and the climate risks, refer to the Map section
                in the wiki.
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/settle")({
    component: SettlePage,
    staticData: {
        title: "Location choice",
        infoModal: {
            contents: <SettleHelp />,
        },
    },
});

interface TileInfoProps {
    selectedTile: HexTileResources;
    playerMap: Record<number, string>;
}

function calculateTileLabel(
    tile: HexTileData,
    activeResourceId: ResourceId | undefined,
    s: number,
    playerMap: Record<number, string>,
): { label: string | null; size: number; fill: string } {
    if (tile.player_id) {
        const username = playerMap[tile.player_id];
        return {
            label: username ? username.slice(0, 3) : null,
            size: 20,
            fill: "black",
        };
    }
    if (activeResourceId !== undefined) {
        return {
            label: formatResourceValue(tile, activeResourceId),
            size: Math.max(10, s / 4),
            fill: "black",
        };
    }
    return { label: null, size: 20, fill: "black" };
}

/** Settlement tiles component - renders all tiles with resource visualization */
interface SettleTilesProps {
    mapData: HexTileData[];
    activeResourceId: ResourceId | undefined;
    selectedTileId: number | null;
    onTileClick: (tile: HexTileData) => void;
    playerMap: Record<number, string>;
}

function SettleTiles({
    mapData,
    activeResourceId,
    onTileClick,
    playerMap,
}: SettleTilesProps) {
    const { s } = useMapContext();
    const { theme } = useTheme();

    return (
        <>
            {mapData.map((tile) => {
                const defaultFill = tile.player_id
                    ? "var(--map-tile-other-player)"
                    : "var(--map-tile-vacant)";
                const fill = calculateTileFillWithResource(
                    tile,
                    activeResourceId,
                    theme,
                    defaultFill,
                );
                const {
                    label,
                    size,
                    fill: labelFill,
                } = calculateTileLabel(tile, activeResourceId, s, playerMap);

                return (
                    <HexTile
                        key={tile.id}
                        tile={tile}
                        fill={fill}
                        label={label}
                        labelSize={size}
                        labelFill={labelFill}
                        onClick={() => onTileClick(tile)}
                    />
                );
            })}
        </>
    );
}

function SettlePage() {
    return <SettleContent />;
}

function SettleContent() {
    const [activeResourceId, setActiveResourceId] = useState<
        ResourceId | undefined
    >(undefined);
    const [selectedTileId, setSelectedTileId] = useState<number | null>(null);

    const { data: mapData, isLoading: isMapLoading } = useMap();
    const { data: playersData, isLoading: isPlayersLoading } = usePlayers();

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

    // Get selected tile
    const selectedTile = useMemo(() => {
        if (selectedTileId === null || !mapData) return null;
        return mapData.find((t) => t.id === selectedTileId) || null;
    }, [selectedTileId, mapData]);

    const handleTileClick = (tile: HexTileData) => {
        // Can't select occupied tiles
        // if (tile.player_id) return;

        // Toggle selection
        if (selectedTileId === tile.id) {
            setSelectedTileId(null);
        } else {
            setSelectedTileId(tile.id);
        }
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
        <div className="p-4 flex flex-col lg:h-screen">
            {/* Title with theme toggle */}
            <div className="flex items-center justify-between gap-3 mb-6 lg:shrink-0">
                <h1 className="text-3xl md:text-4xl font-bold text-center flex-1">
                    Location choice
                </h1>
                <ThemeToggle />
            </div>

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
                <div className="w-full relative pt-[86.60%] lg:pt-0 lg:flex-2 lg:h-full">
                    <MapCanvas className="absolute inset-0" mapData={mapData}>
                        <SettleTiles
                            mapData={mapData}
                            activeResourceId={activeResourceId}
                            selectedTileId={selectedTileId}
                            onTileClick={handleTileClick}
                            playerMap={playerMap}
                        />
                        <MapHoverBorder tile={selectedTile} strokeWidth={4} />
                    </MapCanvas>
                </div>

                {/* Right sidebar - Info/Resources panel */}
                <div className="bg-card p-4 rounded-lg lg:flex-1 lg:min-w-64 lg:max-w-96 lg:flex lg:flex-col">
                    {!selectedTile ? (
                        <div>
                            <h2 className="text-xl font-bold mb-3 text-center">
                                INFO
                            </h2>
                            <p className="text-sm mb-3">
                                Please choose an available location on the map.
                                The menu on the left allows you to see where
                                different natural resources are located on the
                                map. The location choice is DEFINITIVE, you will
                                not be able to change it during the game.
                            </p>
                            <p className="text-sm">
                                If you need help, click on the book icon next to
                                the title.
                            </p>
                        </div>
                    ) : (
                        <TileInfo
                            selectedTile={selectedTile}
                            playerMap={playerMap}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

function TileInfo({ selectedTile, playerMap }: TileInfoProps) {
    const { refetch: refetchAuth } = useAuth();
    const navigate = useNavigate();
    const [isSettling, setIsSettling] = useState(false);

    const handleSettleLocation = useCallback(async () => {
        if (!selectedTile || isSettling) return;

        setIsSettling(true);
        try {
            await mapApi.settleRegion(selectedTile.id);
            // Refresh auth cache to get updated settled status
            await refetchAuth();
            // Redirect to home page after successful settlement
            navigate({ to: "/app/dashboard" });
        } catch (error) {
            console.error("Error settling location:", error);
            alert("Failed to settle location. Please try again.");
            setIsSettling(false);
        }
    }, [selectedTile, isSettling, refetchAuth, navigate]);

    return (
        <div className="lg:flex lg:flex-col lg:h-full animate-fadeIn">
            <h2 className="text-xl font-bold mb-3 text-center lg:shrink-0 animate-slideDown">
                RESOURCES
            </h2>
            <div className="space-y-3 lg:flex-1 lg:overflow-y-auto lg:min-h-0">
                {RESOURCES.map((resource, index) => {
                    const value = getResourceValue(selectedTile, resource.id);
                    const maxValue = MAX_VALUES[resource.id];
                    const barWidth = (value / maxValue) * 100;

                    return (
                        <div
                            key={resource.name}
                            className="animate-fadeIn"
                            style={{
                                animationDelay: `${index * 50}ms`,
                            }}
                        >
                            <div className="flex justify-between text-sm mb-1">
                                <span>{resource.name}</span>
                            </div>
                            {[3, 4, 5].includes(resource.id) && (
                                <div className="text-xs text-right mb-1">
                                    {formatMass(
                                        value,
                                        10000,
                                        `of ${resource.name.toLowerCase()} in the ground`,
                                    )}
                                </div>
                            )}
                            <div className="relative h-4 bg-muted rounded overflow-hidden">
                                <div
                                    className="absolute h-full rounded transition-all duration-500 ease-out"
                                    style={{
                                        width: `${barWidth}%`,
                                        backgroundColor: `hsl(${resource.color}, 95%, 50%)`,
                                    }}
                                />
                            </div>
                            {resource.id === 0 && (
                                <div className="text-xs text-right mt-1">
                                    {Math.round(selectedTile.solar * 1000)} W/m²
                                    irradiation
                                </div>
                            )}
                            {resource.id === 1 && (
                                <div className="text-xs text-right mt-1">
                                    {Math.round(
                                        Math.pow(selectedTile.wind, 0.5) * 50,
                                    )}{" "}
                                    km/h windspeed
                                </div>
                            )}
                            {resource.id === 2 && (
                                <div className="text-xs text-right mt-1">
                                    {Math.round(selectedTile.hydro * 150)} m³/s
                                    river discharge
                                </div>
                            )}
                            {resource.id === 6 && (
                                <div className="text-xs text-right mt-1">
                                    {selectedTile.climate_risk} / 10 score (high
                                    is bad)
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="lg:shrink-0 animate-slideUp">
                {selectedTile.player_id ? (
                    <div className="mt-6 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded text-center text-sm animate-scaleIn">
                        This tile is already occupied by{" "}
                        {playerMap[selectedTile.player_id]}!
                    </div>
                ) : (
                    <button
                        onClick={handleSettleLocation}
                        disabled={isSettling}
                        className="mt-6 w-full px-6 py-3 bg-brand-green hover:bg-brand-green/90 disabled:bg-gray-400 text-white font-bold rounded transition-all active:scale-95 disabled:cursor-not-allowed"
                    >
                        {isSettling ? "Settling..." : "Choose this location"}
                    </button>
                )}
            </div>
        </div>
    );
}
