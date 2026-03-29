/** Settlement page - allows player to choose their starting location on the map. */

import { Dialog } from "@radix-ui/react-dialog";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { useState, useMemo, useCallback } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import { MapHoverBorder } from "@/components/map/map-hover-border";
import { MapTiles } from "@/components/map/map-tiles";
import { ResourceButton } from "@/components/map/resource-button";
import { Button, ThemeToggle } from "@/components/ui";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { TypographyH1, TypographyH2 } from "@/components/ui/typography";
import { useAuth } from "@/hooks/use-auth";
import { useMap } from "@/hooks/use-map";
import { usePlayers } from "@/hooks/use-players";
import { mapApi } from "@/lib/api/map";
import { formatMass } from "@/lib/format-utils";
import {
    RESOURCES,
    MAX_VALUES,
    ResourceId,
    getResourceValue,
    oklchToString,
} from "@/lib/map-resources";
import { HexTileResources } from "@/types/map";

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
        infoDialog: {
            contents: <SettleHelp />,
        },
    },
});

interface TileInfoProps {
    selectedTile: HexTileResources;
    playerMap: Record<number, string>;
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

    const handleTileClick = (tile: HexTileResources) => {
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

    const [isShowingHelp, setShowingHelp] = useState(false);
    const handleShowHelp = useCallback(() => setShowingHelp(true), []);
    const handleCloseHelp = useCallback(() => setShowingHelp(false), []);

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
            <div className="flex items-center gap-3 mb-6 lg:shrink-0">
                <div className="flex-1" />
                <TypographyH1 className="text-center">
                    Location choice
                </TypographyH1>
                <div className="flex-1 flex justify-end">
                    <ButtonGroup>
                        <Button
                            onClick={() => handleShowHelp()}
                            variant="outline"
                            size="icon"
                            aria-label="Show help"
                        >
                            <HelpCircle size={20} />
                        </Button>
                        <ThemeToggle />
                    </ButtonGroup>
                </div>
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
                        <MapTiles
                            mapData={mapData}
                            activeResourceId={activeResourceId}
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
                            <TypographyH2 className="mb-3 text-center">
                                Welcome!
                            </TypographyH2>
                            <p className="text-sm mb-3">
                                Choose an available location on the map. The
                                location choice is <b>definitive</b> - you will
                                not be able to change it during the game.
                            </p>
                            <p className="text-sm mb-3">
                                Use the buttons to see where different natural
                                resources are located on the map to make an
                                informed decision.
                            </p>
                            <p className="text-sm">
                                If you need help, click on the help button in
                                the top right corner.
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
            <Dialog
                open={isShowingHelp}
                onOpenChange={(open) => !open && handleCloseHelp()}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{"Help: Location Choice"}</DialogTitle>
                        <DialogDescription>
                            Information and help for this page.
                        </DialogDescription>
                    </DialogHeader>
                    <SettleHelp />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function TileInfo({ selectedTile, playerMap }: TileInfoProps) {
    const { refetch: refetchAuth } = useAuth();
    const navigate = useNavigate();
    const [isSettling, setIsSettling] = useState(false);

    const handleSettleLocation = useCallback(async () => {
        if (isSettling) return;

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
            <TypographyH2 className="mb-3 text-center lg:shrink-0 animate-slideDown">
                Resources
            </TypographyH2>
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
                                        backgroundColor: oklchToString(resource.color),
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
                    <Button
                        variant="success"
                        size="lg"
                        className="mt-6 w-full font-bold"
                        onClick={handleSettleLocation}
                        disabled={isSettling}
                    >
                        {isSettling ? "Settling..." : "Choose this location"}
                    </Button>
                )}
            </div>
        </div>
    );
}
