/** Revenues overview page - Revenue and expenses visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { DollarSign } from "lucide-react";

import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout/GameLayout";
import { Card, CardTitle } from "@/components/ui";
import { useGameTick } from "@/hooks/useGameTick";
import { useCurrentChartData } from "@/hooks/useCharts";
import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
import {
    TimeSeriesChart,
    ResolutionPicker,
    RevenuesOverviewTable,
    filterNonZeroSeries,
    createExcludeKeysFilter,
    includeAllSeries,
    type ResolutionOption,
    type TimeSeriesChartConfig,
} from "@/components/charts";
import { ChartType } from "@/types/charts";

type RevenueType = "revenues" | "expenses" | "all";

export const Route = createFileRoute("/app/overviews/revenues")({
    component: RevenuesOverviewPage,
    staticData: { title: "Revenues Overview" },
});

function RevenuesOverviewPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <RevenuesOverviewContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

function RevenuesOverviewContent() {
    const { currentTick } = useGameTick();
    const [selectedResolutionIndex, setSelectedResolutionIndex] = useState(0);
    const [viewMode, setViewMode] = useState<"normal" | "percent">("normal");
    const [revenueType, setRevenueType] = useState<RevenueType>("revenues");
    const [hiddenFacilities, setHiddenFacilities] = useState<Set<string>>(
        new Set(),
    );
    const dataPoints = selectedResolutionIndex === 0 ? 60 : 360;

    const selectedResolution = RESOLUTIONS[selectedResolutionIndex];

    // Fetch both revenue and op-costs chart data
    const {
        chartData: revenuesData,
        isLoading: isRevenuesLoading,
        isError: isRevenuesError,
    } = useCurrentChartData({
        chartType: "revenues",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: dataPoints,
    });

    const {
        chartData: opCostsData,
        isLoading: isOpCostsLoading,
        isError: isOpCostsError,
    } = useCurrentChartData({
        chartType: "op-costs",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: dataPoints,
    });

    const isChartLoading = isRevenuesLoading || isOpCostsLoading;
    const isError = isRevenuesError || isOpCostsError;

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

    // Merge and filter data based on revenue type
    const filteredChartData = useMemo(() => {
        if (!revenuesData || revenuesData.length === 0) {
            return [];
        }

        // Create a map of ticks for easy merging
        const tickMap = new Map<number, Record<string, number>>();

        // Process revenues data
        revenuesData.forEach((dataPoint: Record<string, number>) => {
            if (!tickMap.has(dataPoint.tick)) {
                tickMap.set(dataPoint.tick, { tick: dataPoint.tick });
            }
            const result = tickMap.get(dataPoint.tick)!;

            Object.keys(dataPoint).forEach((key) => {
                if (key === "tick") return;

                const value = dataPoint[key] || 0;

                if (revenueType === "revenues") {
                    // Only include positive values from revenues
                    result[key] = value > 0 ? value : 0;
                } else if (revenueType === "expenses") {
                    // Only include negative values from revenues, displayed as positive
                    result[key] = value < 0 ? Math.abs(value) : 0;
                } else if (revenueType === "all") {
                    // For "all": aggregate into single "net" value
                    result["net"] = (result["net"] || 0) + value;
                }
            });
        });

        // Process op-costs data (only for expenses and all views)
        if (
            (revenueType === "expenses" || revenueType === "all") &&
            opCostsData &&
            opCostsData.length > 0
        ) {
            opCostsData.forEach((dataPoint: Record<string, number>) => {
                if (!tickMap.has(dataPoint.tick)) {
                    tickMap.set(dataPoint.tick, { tick: dataPoint.tick });
                }
                const result = tickMap.get(dataPoint.tick)!;

                Object.keys(dataPoint).forEach((key) => {
                    if (key === "tick") return;

                    const value = dataPoint[key] || 0;

                    if (revenueType === "expenses") {
                        // Op-costs are negative, display as positive for expenses view
                        // Initialize the key if it doesn't exist yet
                        if (!(key in result)) {
                            result[key] = 0;
                        }
                        result[key] += Math.abs(value);
                    } else if (revenueType === "all") {
                        // For "all": aggregate op-costs into single "net" value
                        result["net"] = (result["net"] || 0) + value;
                    }
                });
            });
        }

        // Convert map to sorted array
        return Array.from(tickMap.values()).sort((a, b) => a.tick - b.tick);
    }, [revenuesData, opCostsData, revenueType]);

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-8">
                Revenues Overview
            </h1>

            <Card className="mb-6">
                <div className="space-y-4">
                    <RevenueTypePicker
                        revenueType={revenueType}
                        onRevenueTypeChange={setRevenueType}
                    />
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
                    <DollarSign className="w-6 h-6 text-amber-500" />
                    <CardTitle>
                        {revenueType === "revenues"
                            ? "Revenues"
                            : revenueType === "expenses"
                              ? "Expenses"
                              : "Revenues & Expenses"}
                    </CardTitle>
                </div>

                <RevenuesChart
                    chartData={filteredChartData}
                    isLoading={isChartLoading}
                    isError={isError}
                    hiddenFacilities={hiddenFacilities}
                    viewMode={viewMode}
                    revenueType={revenueType}
                />

                <div className="mt-6">
                    <RevenuesOverviewTable
                        chartData={filteredChartData}
                        revenueType={revenueType}
                        hiddenFacilities={hiddenFacilities}
                        onToggleFacility={handleToggleFacility}
                    />
                </div>
            </Card>
        </div>
    );
}

interface RevenuesChartProps {
    chartData: any[];
    isLoading: boolean;
    isError: boolean;
    hiddenFacilities: Set<string>;
    viewMode: "normal" | "percent";
    revenueType: RevenueType;
}

function RevenuesChart({
    chartData,
    isLoading,
    isError,
    hiddenFacilities,
    viewMode,
    revenueType,
}: RevenuesChartProps) {
    const getColor = useAssetColorGetter();

    // Create a composite filter that combines non-zero filtering with visibility filtering
    const filterDataKeys = useMemo(() => {
        // For "all" view, use includeAllSeries since we have a single aggregated "net" value
        // filterNonZeroSeries only keeps values > 0, which filters out negative values
        const baseFilter =
            revenueType === "all" ? includeAllSeries : filterNonZeroSeries;

        if (hiddenFacilities.size === 0) {
            return baseFilter;
        }

        const excludeFilter = createExcludeKeysFilter(
            Array.from(hiddenFacilities),
        );

        // Combine both filters: must pass base filter AND not be hidden
        return (key: string, data: any[]) => {
            return baseFilter(key, data) && excludeFilter(key, data);
        };
    }, [hiddenFacilities, revenueType]);

    // Transform data for percent view if needed
    const transformedData = useMemo(() => {
        if (viewMode === "normal" || !chartData || chartData.length === 0) {
            return chartData;
        }

        // For percent view, calculate percentage based on total
        return chartData.map((dataPoint) => {
            const result: Record<string, number> = { tick: dataPoint.tick };

            // Calculate total for this datapoint
            let total = 0;
            Object.keys(dataPoint).forEach((key) => {
                if (key !== "tick") {
                    total += Math.abs(dataPoint[key] || 0);
                }
            });

            Object.keys(dataPoint).forEach((key) => {
                if (key === "tick") return;

                const value = dataPoint[key] || 0;
                if (total > 0) {
                    // Preserve sign in percent view
                    result[key] = (value / total) * 100;
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

interface RevenueTypePickerProps {
    revenueType: RevenueType;
    onRevenueTypeChange: (type: RevenueType) => void;
}

function RevenueTypePicker({
    revenueType,
    onRevenueTypeChange,
}: RevenueTypePickerProps) {
    return (
        <div>
            <label className="block text-sm font-medium mb-2">
                Revenue Type
            </label>
            <div className="flex gap-2">
                <button
                    onClick={() => onRevenueTypeChange("revenues")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        revenueType === "revenues"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    Revenues
                </button>
                <button
                    onClick={() => onRevenueTypeChange("expenses")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        revenueType === "expenses"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    Expenses
                </button>
                <button
                    onClick={() => onRevenueTypeChange("all")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        revenueType === "all"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    All
                </button>
            </div>
        </div>
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
