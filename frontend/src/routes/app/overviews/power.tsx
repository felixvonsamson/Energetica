/** Power overview page - Electricity generation visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { Zap } from "lucide-react";

import { RequireSettledPlayer } from "@components/auth/ProtectedRoute";
import { GameLayout } from "@components/layout/GameLayout";
import { Card, CardTitle } from "@components/ui";
import { useGameTick } from "@hooks/useGameTick";
import { useCurrentChartData } from "@hooks/useCharts";
import { useAssetColorGetter } from "@hooks/useAssetColorGetter";
import { ChartType } from "@app-types/charts";
import {
    TimeSeriesChart,
    ResolutionPicker,
    PowerOverviewTable,
    filterNonZeroSeries,
    createExcludeKeysFilter,
    type ResolutionOption,
    type TimeSeriesChartConfig,
} from "@components/charts";

export const Route = createFileRoute("/app/overviews/power")({
    component: PowerOverviewPage,
    staticData: { title: "Power Overview" },
});

function PowerOverviewPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <PowerOverviewContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

function PowerOverviewContent() {
    const { currentTick } = useGameTick();
    const [selectedResolutionIndex, setSelectedResolutionIndex] = useState(1);
    const [chartType, setChartType] = useState<ChartType>("power-sources");
    const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());
    const [hiddenSinks, setHiddenSinks] = useState<Set<string>>(new Set());
    const dataPoints = selectedResolutionIndex === 0 ? 60 : 360;

    const selectedResolution = RESOLUTIONS[selectedResolutionIndex];

    // Fetch chart data to share between chart and table
    const {
        chartData,
        isLoading: isChartLoading,
        isError,
    } = useCurrentChartData({
        chartType,
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: dataPoints,
    });

    // Get the appropriate hidden set based on chart type
    const hiddenFacilities =
        chartType === "power-sources" ? hiddenSources : hiddenSinks;
    const setHiddenFacilities =
        chartType === "power-sources" ? setHiddenSources : setHiddenSinks;

    // Toggle facility visibility
    const handleToggleFacility = useCallback(
        (facilityType: string) => {
            setHiddenFacilities((prev) => {
                const next = new Set(prev);
                if (next.has(facilityType)) {
                    next.delete(facilityType);
                } else {
                    next.add(facilityType);
                }
                return next;
            });
        },
        [setHiddenFacilities],
    );

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-8">
                Power Overview
            </h1>

            <Card className="mb-6">
                <div className="space-y-4">
                    <ChartTypePicker
                        chartType={chartType}
                        onChartTypeChange={setChartType}
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
                    <Zap className="w-6 h-6 text-yellow-500" />
                    <CardTitle>
                        {chartType === "power-sources"
                            ? "Power Generation"
                            : "Power Consumption"}
                    </CardTitle>
                </div>

                <PowerChart
                    chartData={chartData}
                    isLoading={isChartLoading}
                    isError={isError}
                    hiddenFacilities={hiddenFacilities}
                />

                <div className="mt-6">
                    <PowerOverviewTable
                        chartType={chartType}
                        chartData={chartData}
                        resolution={selectedResolution.resolution}
                        hiddenFacilities={hiddenFacilities}
                        onToggleFacility={handleToggleFacility}
                    />
                </div>
            </Card>
        </div>
    );
}

interface PowerChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenFacilities: Set<string>;
}

function PowerChart({
    chartData,
    isLoading,
    isError,
    hiddenFacilities,
}: PowerChartProps) {
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
        return (key: string, data: unknown[]) => {
            return filterNonZeroSeries(key, data) && excludeFilter(key);
        };
    }, [hiddenFacilities]);

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
            data={chartData as Array<Record<string, unknown>>}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}

interface ChartTypePickerProps {
    chartType: ChartType;
    onChartTypeChange: (type: ChartType) => void;
}

function ChartTypePicker({
    chartType,
    onChartTypeChange,
}: ChartTypePickerProps) {
    return (
        <div>
            <label className="block text-sm font-medium mb-2">Chart Type</label>
            <div className="flex gap-2">
                <button
                    onClick={() => onChartTypeChange("power-sources")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        chartType === "power-sources"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    Generation (Sources)
                </button>
                <button
                    onClick={() => onChartTypeChange("power-sinks")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        chartType === "power-sinks"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    Consumption (Sinks)
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
