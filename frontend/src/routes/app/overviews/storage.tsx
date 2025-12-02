/** Storage overview page - Energy storage visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { Battery } from "lucide-react";

import { RequireSettledPlayer } from "@components/auth/ProtectedRoute";
import { GameLayout } from "@components/layout/GameLayout";
import { Card, CardTitle } from "@components/ui";
import { useGameTick } from "@hooks/useGameTick";
import { useCurrentChartData } from "@hooks/useCharts";
import { useAssetColorGetter } from "@hooks/useAssetColorGetter";
import { Resolution, ChartType } from "@app-types/charts";
import {
    TimeSeriesChart,
    ResolutionPicker,
    StorageOverviewTable,
    filterNonZeroSeries,
    createExcludeKeysFilter,
    type ResolutionOption,
    type TimeSeriesChartConfig,
} from "@components/charts";

export const Route = createFileRoute("/app/overviews/storage")({
    component: StorageOverviewPage,
    staticData: { title: "Storage Overview" },
});

function StorageOverviewPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <StorageOverviewContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

function StorageOverviewContent() {
    const { currentTick } = useGameTick();
    const [selectedResolutionIndex, setSelectedResolutionIndex] = useState(0);
    const [viewMode, setViewMode] = useState<"normal" | "percent">("normal");
    const [hiddenFacilities, setHiddenFacilities] = useState<Set<string>>(
        new Set(),
    );
    const dataPoints = selectedResolutionIndex === 0 ? 60 : 360;

    const selectedResolution = RESOLUTIONS[selectedResolutionIndex];

    // Fetch chart data to share between chart and table
    const {
        chartData,
        isLoading: isChartLoading,
        isError,
    } = useCurrentChartData({
        chartType: "storage-level",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: dataPoints,
    });

    // Toggle facility visibility
    const handleToggleFacility = useCallback((facilityType: string) => {
        setHiddenFacilities((prev) => {
            const next = new Set(prev);
            if (next.has(facilityType)) {
                next.delete(facilityType);
            } else {
                next.add(facilityType);
            }
            return next;
        });
    }, []);

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-8">
                Storage Overview
            </h1>

            <Card className="mb-6">
                <div className="space-y-4">
                    <ViewModePicker
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                    />
                    <ResolutionPicker
                        resolutions={RESOLUTIONS}
                        selectedResolutionIndex={selectedResolutionIndex}
                        onResolutionChange={setSelectedResolutionIndex}
                        currentTick={currentTick}
                    />
                </div>
            </Card>

            <Card className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Battery className="w-6 h-6 text-blue-500" />
                    <CardTitle>Stored Energy</CardTitle>
                </div>

                <StorageChart
                    chartData={chartData}
                    isLoading={isChartLoading}
                    isError={isError}
                    hiddenFacilities={hiddenFacilities}
                    viewMode={viewMode}
                />

                <div className="mt-6">
                    <StorageOverviewTable
                        chartData={chartData}
                        hiddenFacilities={hiddenFacilities}
                        onToggleFacility={handleToggleFacility}
                    />
                </div>
            </Card>
        </div>
    );
}

interface StorageChartProps {
    chartData: any[];
    isLoading: boolean;
    isError: boolean;
    hiddenFacilities: Set<string>;
    viewMode: "normal" | "percent";
}

function StorageChart({
    chartData,
    isLoading,
    isError,
    hiddenFacilities,
    viewMode,
}: StorageChartProps) {
    const getColor = useAssetColorGetter();

    // Create a composite filter that combines non-zero filtering with visibility filtering
    const filterDataKeys = useMemo(() => {
        if (hiddenFacilities.size === 0) {
            return filterNonZeroSeries;
        }

        const excludeFilter = createExcludeKeysFilter(
            Array.from(hiddenFacilities),
        );

        // Combine both filters: must pass non-zero AND not be hidden
        return (key: string, data: any[]) => {
            return filterNonZeroSeries(key, data) && excludeFilter(key, data);
        };
    }, [hiddenFacilities]);

    // Transform data for percent view if needed
    const transformedData = useMemo(() => {
        if (viewMode === "normal" || !chartData || chartData.length === 0) {
            return chartData;
        }

        // For percent view, we need to calculate the percentage of capacity for each facility
        // This requires knowing the max capacity for each facility
        // For now, we'll calculate percentage based on the max value in the series
        return chartData.map((dataPoint) => {
            const result: Record<string, number> = { tick: dataPoint.tick };

            Object.keys(dataPoint).forEach((key) => {
                if (key === "tick") return;

                // Find max value for this facility across all datapoints
                const maxValue = Math.max(...chartData.map((d) => d[key] || 0));

                if (maxValue > 0) {
                    result[key] = ((dataPoint[key] || 0) / maxValue) * 100;
                } else {
                    result[key] = 0;
                }
            });

            return result;
        });
    }, [chartData, viewMode]);

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: "area",
            stacked: true,
            height: 400,
            showBrush: true,
            getColor,
            filterDataKeys,
        }),
        [getColor, filterDataKeys],
    );

    return (
        <TimeSeriesChart
            data={transformedData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}

interface ViewModePickerProps {
    viewMode: "normal" | "percent";
    onViewModeChange: (mode: "normal" | "percent") => void;
}

function ViewModePicker({ viewMode, onViewModeChange }: ViewModePickerProps) {
    return (
        <div>
            <label className="block text-sm font-medium mb-2">View Mode</label>
            <div className="flex gap-2">
                <button
                    onClick={() => onViewModeChange("normal")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        viewMode === "normal"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    Normal
                </button>
                <button
                    onClick={() => onViewModeChange("percent")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        viewMode === "percent"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    Percent
                </button>
            </div>
        </div>
    );
}

const RESOLUTIONS: ResolutionOption[] = [
    { id: 0, label: "4h", resolution: 1 },
    { id: 1, label: "24h", resolution: 1 },
    { id: 2, label: "6 days", resolution: 6 },
    { id: 3, label: "6 months", resolution: 36 },
    { id: 4, label: "3 years", resolution: 216 },
    { id: 5, label: "18 years", resolution: 1296 },
];
