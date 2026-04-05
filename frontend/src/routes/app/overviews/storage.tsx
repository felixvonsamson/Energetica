/** Storage overview page - Energy storage visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { Battery, TrendingUp, BarChart3, Funnel } from "lucide-react";
import { useState } from "react";

import {
    StorageChart,
    StorageOverviewTable,
} from "@/components/charts/storage-chart";
import { GameLayout } from "@/components/layout/game-layout";
import { CardContent, PageCard } from "@/components/ui";
import { ChartCard } from "@/components/ui/chart-card";
import { Label } from "@/components/ui/label";
import { ResolutionPicker } from "@/components/ui/resolution-picker";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useChartData } from "@/hooks/use-charts";
import { useGameTick } from "@/hooks/use-game-tick";
import { useToggleSet } from "@/hooks/use-toggle-set";

export const Route = createFileRoute("/app/overviews/storage")({
    component: StorageOverviewPage,
    staticData: {
        title: "Storage Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) =>
                cap.has_storage
                    ? { unlocked: true }
                    : { unlocked: false, reason: "Build a Storage Facility to unlock" },
        },
        infoDialog: {
            contents: <StorageOverviewHelp />,
        },
    },
});

function StorageOverviewHelp() {
    return (
        <div className="space-y-3">
            <p>
                This page shows the energy stored in your storage facilities
                over time.
            </p>
            <ul className="list-none space-y-1 ml-4">
                <li className="flex items-center gap-2">
                    <Battery className="w-4 h-4 shrink-0" />
                    <span>
                        View stored energy levels for batteries, pumped hydro,
                        and other storage facilities
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    <span>
                        Track charging and discharging patterns to optimize
                        energy management
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 shrink-0" />
                    <span>
                        Toggle between normal view (absolute energy) and percent
                        view (% of capacity)
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Funnel className="w-4 h-4 shrink-0" />
                    <span>
                        Use the table to toggle individual storage facilities
                        on/off in the chart to focus on specific facilities.
                    </span>
                </li>
            </ul>
        </div>
    );
}

function StorageOverviewPage() {
    return (
        <GameLayout>
            <StorageOverviewContent />
        </GameLayout>
    );
}

const VIEW_MODE_OPTIONS = [
    { value: "normal", label: "Stored Capacity" },
    { value: "percent", label: "State of Charge" },
] as const;

function StorageOverviewContent() {
    const { currentTick } = useGameTick();
    const [viewMode, setViewMode] = useState<"normal" | "percent">("normal");
    const [hiddenFacilities, toggleFacility] = useToggleSet<string>();

    const { selectedResolution } = useTimeMode();

    // Fetch absolute energy levels for the table (always needed)
    const {
        chartData: storageLevelData,
        isLoading: isLevelLoading,
        isError: isLevelError,
    } = useChartData({
        config: {
            chartType: "storage-level",
            resolution: selectedResolution.resolution,
        },
        maxDatapoints: selectedResolution.datapoints,
    });

    // Fetch server-computed SoC (0-1 fraction) for the percent view
    const {
        chartData: storageSocData,
        isLoading: isSocLoading,
        isError: isSocError,
    } = useChartData({
        config: {
            chartType: "storage-soc",
            resolution: selectedResolution.resolution,
        },
        maxDatapoints: selectedResolution.datapoints,
    });

    const chartData =
        viewMode === "percent" ? storageSocData : storageLevelData;
    const isChartLoading =
        viewMode === "percent" ? isSocLoading : isLevelLoading;
    const isError = viewMode === "percent" ? isSocError : isLevelError;

    return (
        <div className="py-4 md:p-8 space-y-6">
            <PageCard>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2">View Mode</Label>
                            <SegmentedPicker
                                value={viewMode}
                                onValueChange={(value) =>
                                    setViewMode(value as "normal" | "percent")
                                }
                            >
                                {VIEW_MODE_OPTIONS.map((option) => (
                                    <SegmentedPickerOption
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SegmentedPickerOption>
                                ))}
                            </SegmentedPicker>
                        </div>
                        <ResolutionPicker currentTick={currentTick} />
                    </div>
                </CardContent>
            </PageCard>

            <ChartCard
                icon={Battery}
                iconClassName="text-primary"
                title="Stored Energy"
            >
                <StorageChart
                    chartData={chartData}
                    isLoading={isChartLoading}
                    isError={isError}
                    hiddenFacilities={hiddenFacilities}
                    viewMode={viewMode}
                />

                <StorageOverviewTable
                    chartData={storageLevelData}
                    hiddenFacilities={hiddenFacilities}
                    onToggleFacility={toggleFacility}
                />
            </ChartCard>
        </div>
    );
}
