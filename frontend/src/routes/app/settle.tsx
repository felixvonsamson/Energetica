/** Settlement page - allows player to choose their starting location on the map. */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { HelpCircle } from "lucide-react";

import { Modal, ThemeToggle } from "@/components/ui";
import { HexTile } from "@/components/map/HexTile";
import { MapCanvas } from "@/components/map/MapCanvas";
import { useMap } from "@/hooks/useMap";
import { usePlayers } from "@/hooks/usePlayers";
import { useAuth } from "@/hooks/useAuth";
import { mapApi } from "@/lib/map-api";
import { formatMass } from "@/lib/format-utils";
import type { ApiResponse } from "@/types/api-helpers";
import { MapHoverBorder } from "@/components/map/MapHoverBorder";
import { useMapContext } from "@/contexts/MapContext";

type HexTileData = ApiResponse<"/api/v1/map", "get">[number];
type ResourceId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const Route = createFileRoute("/app/settle")({
    component: SettlePage,
    staticData: {
        title: "Location choice",
    },
});

// Resource types available for filtering
const RESOURCES = [
    { id: 0, name: "Solar", color: 59 },
    { id: 1, name: "Wind", color: 186 },
    { id: 2, name: "Hydro", color: 239 },
    { id: 3, name: "Coal", color: 0 },
    { id: 4, name: "Gas", color: 275 },
    { id: 5, name: "Uranium", color: 109 },
    { id: 6, name: "Climate risk", color: 320 },
] as const;

// Max values for each resource (for normalization in colouring)
const MAX_VALUES = [1, 1, 1, 2_000_000_000, 600_000_000, 8_000_000, 10];

interface ResourceButtonProps {
    resource: (typeof RESOURCES)[number];
    isActive: boolean;
    onClick: () => void;
}

function ResourceButton({ resource, isActive, onClick }: ResourceButtonProps) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-3 rounded transition-all border-2 flex-1 font-medium ${
                isActive
                    ? "border-white dark:border-white shadow-lg scale-105 text-white dark:text-white"
                    : "text-gray-800 dark:text-gray-200 border-transparent hover:border-gray-400 dark:hover:border-gray-500 bg-bone dark:bg-stone-700 hover:bg-tan-hover dark:hover:bg-stone-600"
            }`}
            style={{
                backgroundColor: isActive
                    ? `hsl(${resource.color}, 55%, 50%)`
                    : undefined,
            }}
        >
            {resource.name}
        </button>
    );
}

function getResourceValue(tile: HexTileData, resourceId: number): number {
    switch (resourceId) {
        case 0:
            return tile.solar;
        case 1:
            return tile.wind;
        case 2:
            return tile.hydro;
        case 3:
            return tile.coal;
        case 4:
            return tile.gas;
        case 5:
            return tile.uranium;
        case 6:
            return tile.climate_risk;
        default:
            return 0;
    }
}

function formatResourceValue(
    tile: HexTileData,
    resourceId: ResourceId,
): string {
    const value = getResourceValue(tile, resourceId);
    if ([0, 1, 2].includes(resourceId)) {
        return `${Math.round(value * 100)}%`;
    } else if ([3, 4, 5].includes(resourceId)) {
        return formatMass(value);
    } else {
        return value.toString();
    }
}

function calculateTileFill(
    tile: HexTileData,
    activeResourceId: ResourceId | undefined,
): string {
    if (tile.player_id) {
        return "var(--map-tile-other-player)";
    } else if (activeResourceId !== undefined) {
        const resourceValue = getResourceValue(tile, activeResourceId);
        const maxValue = MAX_VALUES[activeResourceId];
        const saturation = (resourceValue / maxValue) * 100;
        const hue = RESOURCES[activeResourceId].color;
        return `hsl(${hue}, ${saturation}%, 50%)`;
    } else {
        return "var(--map-tile-vacant)";
    }
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
    selectedTileId,
    onTileClick,
    playerMap,
}: SettleTilesProps) {
    const { s } = useMapContext();

    return (
        <>
            {mapData.map((tile) => {
                const fill = calculateTileFill(tile, activeResourceId);
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
    const navigate = useNavigate();
    const { user, isLoading: isAuthLoading, refetch: refetchAuth } = useAuth();
    const [showInfoPopup, setShowInfoPopup] = useState(false);
    const [activeResourceId, setActiveResourceId] = useState<
        ResourceId | undefined
    >(undefined);
    const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
    const [isSettling, setIsSettling] = useState(false);

    const { data: mapData, isLoading: isMapLoading } = useMap();
    const { data: playersData, isLoading: isPlayersLoading } = usePlayers();

    // Redirect if player is already settled
    useEffect(() => {
        if (!isAuthLoading && user?.is_settled) {
            navigate({ to: "/app/dashboard" });
        }
    }, [user?.is_settled, isAuthLoading, navigate]);

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

    const handleSettleLocation = async () => {
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
    };

    if (isAuthLoading || isMapLoading || isPlayersLoading) {
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
            {/* Title with info icon and theme toggle */}
            <div className="flex items-center justify-between gap-3 mb-6 lg:shrink-0">
                <h1 className="text-3xl md:text-4xl font-bold text-center flex-1">
                    Location choice
                </h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowInfoPopup(true)}
                        className="text-primary hover:opacity-80 transition-opacity"
                        aria-label="Show help"
                    >
                        <HelpCircle className="w-8 h-8" />
                    </button>
                    <ThemeToggle />
                </div>
            </div>

            {/* Info modal */}
            <Modal
                isOpen={showInfoPopup}
                onClose={() => setShowInfoPopup(false)}
                title="Help : Location choice"
            >
                <div className="space-y-3">
                    <p>
                        The first decisions you have to make in the game is to
                        choose an available location on the map. The menu on the
                        left allows you to see where different natural resources
                        are located.
                    </p>
                    <p>
                        The location choice is <strong>definitive</strong>, you
                        will not be able to change it during the game so choose
                        wisely.
                    </p>
                    <p>
                        For more detailed information about the map, the
                        resources you can find on it and the climate risks,
                        refer to the Map section in the wiki.
                    </p>
                </div>
            </Modal>

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
                <div className="bg-bone dark:bg-dark-bg-secondary p-4 rounded-lg lg:flex-1 lg:min-w-64 lg:max-w-96 lg:flex lg:flex-col">
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
                        <div className="lg:flex lg:flex-col lg:h-full animate-fadeIn">
                            <h2 className="text-xl font-bold mb-3 text-center lg:shrink-0 animate-slideDown">
                                RESOURCES
                            </h2>
                            <div className="space-y-3 lg:flex-1 lg:overflow-y-auto lg:min-h-0">
                                {RESOURCES.map((resource, index) => {
                                    const value = getResourceValue(
                                        selectedTile,
                                        resource.id,
                                    );
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
                                            {[3, 4, 5].includes(
                                                resource.id,
                                            ) && (
                                                <div className="text-xs text-right mb-1">
                                                    {formatMass(
                                                        value,
                                                        10_000,
                                                        `of ${resource.name.toLowerCase()} in the ground`,
                                                    )}
                                                </div>
                                            )}
                                            <div className="relative h-4 bg-white dark:bg-dark-bg-tertiary rounded overflow-hidden">
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
                                                    {Math.round(
                                                        selectedTile.solar *
                                                            1000,
                                                    )}{" "}
                                                    W/m² irradiation
                                                </div>
                                            )}
                                            {resource.id === 1 && (
                                                <div className="text-xs text-right mt-1">
                                                    {Math.round(
                                                        Math.pow(
                                                            selectedTile.wind,
                                                            0.5,
                                                        ) * 50,
                                                    )}{" "}
                                                    km/h windspeed
                                                </div>
                                            )}
                                            {resource.id === 2 && (
                                                <div className="text-xs text-right mt-1">
                                                    {Math.round(
                                                        selectedTile.hydro *
                                                            150,
                                                    )}{" "}
                                                    m³/s river discharge
                                                </div>
                                            )}
                                            {resource.id === 6 && (
                                                <div className="text-xs text-right mt-1">
                                                    {selectedTile.climate_risk}{" "}
                                                    / 10 score (high is bad)
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
                                        {isSettling
                                            ? "Settling..."
                                            : "Choose this location"}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
