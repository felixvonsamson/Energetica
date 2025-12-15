/** Revenues overview page - Revenue and expenses visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { DollarSign } from "lucide-react";
import { useState, useMemo, useCallback } from "react";

import {
    TimeSeriesChart,
    ResolutionPicker,
    RevenuesOverviewTable,
    filterNonZeroSeries,
    createExcludeKeysFilter,
    includeAllSeries,
    type TimeSeriesChartConfig,
} from "@/components/charts";
import { GameLayout } from "@/components/layout/GameLayout";
import { Card, CardTitle, CashFlow } from "@/components/ui";
import { useTimeMode } from "@/contexts/TimeModeContext";
import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
import { useCurrentChartData } from "@/hooks/useCharts";
import { useGameTick } from "@/hooks/useGameTick";

type RevenueType = "revenues" | "expenses" | "net-profit";
type NetProfitViewMode = "net" | "breakdown";

export const Route = createFileRoute("/app/overviews/revenues")({
    component: RevenuesOverviewPage,
    staticData: {
        title: "Revenues Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
        },
    },
});

function RevenuesOverviewPage() {
    return (
        <GameLayout>
            <RevenuesOverviewContent />
        </GameLayout>
    );
}

function RevenuesOverviewContent() {
    const { currentTick } = useGameTick();
    const [viewMode, setViewMode] = useState<"normal" | "percent">("normal");
    const [netProfitViewMode, setNetProfitViewMode] =
        useState<NetProfitViewMode>("net");
    const [revenueType, setRevenueType] = useState<RevenueType>("revenues");
    const [hiddenFacilities, setHiddenFacilities] = useState<Set<string>>(
        new Set(),
    );
    const { selectedResolution } = useTimeMode();

    // Fetch both revenue and op-costs chart data
    const {
        chartData: revenuesData,
        isLoading: isRevenuesLoading,
        isError: isRevenuesError,
    } = useCurrentChartData({
        chartType: "revenues",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
    });

    const {
        chartData: opCostsData,
        isLoading: isOpCostsLoading,
        isError: isOpCostsError,
    } = useCurrentChartData({
        chartType: "op-costs",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
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
                } else if (revenueType === "net-profit") {
                    if (netProfitViewMode === "net") {
                        // For "net": aggregate into single "net-profit" value
                        result["net-profit"] =
                            (result["net-profit"] || 0) + value;
                    } else {
                        // For "breakdown": track gross revenues and expenses separately
                        if (value > 0) {
                            result["gross-revenues"] =
                                (result["gross-revenues"] || 0) + value;
                        } else if (value < 0) {
                            result["total-expenses"] =
                                (result["total-expenses"] || 0) +
                                Math.abs(value);
                        }
                    }
                }
            });
        });

        // Process op-costs data (only for expenses and all views)
        if (
            (revenueType === "expenses" || revenueType === "net-profit") &&
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
                    } else if (revenueType === "net-profit") {
                        if (netProfitViewMode === "net") {
                            // For "net": aggregate op-costs into single "net-profit" value
                            result["net-profit"] =
                                (result["net-profit"] || 0) + value;
                        } else {
                            // For "breakdown": add op-costs to total expenses
                            result["total-expenses"] =
                                (result["total-expenses"] || 0) +
                                Math.abs(value);
                        }
                    }
                });
            });
        }

        // Convert map to sorted array
        let result = Array.from(tickMap.values()).sort(
            (a, b) => a.tick - b.tick,
        );

        // For breakdown mode, transform gross-revenues and total-expenses into stacked series
        if (revenueType === "net-profit" && netProfitViewMode === "breakdown") {
            result = result.map((dataPoint) => {
                const grossRevenues = dataPoint["gross-revenues"] || 0;
                const totalExpenses = dataPoint["total-expenses"] || 0;

                return {
                    tick: dataPoint.tick,
                    baseline: Math.min(grossRevenues, totalExpenses),
                    profit: Math.max(0, grossRevenues - totalExpenses),
                    loss: Math.max(0, totalExpenses - grossRevenues),
                };
            });
        }

        return result;
    }, [revenuesData, opCostsData, revenueType, netProfitViewMode]);

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
                    {revenueType === "net-profit" ? (
                        <NetProfitViewModePicker
                            viewMode={netProfitViewMode}
                            onViewModeChange={setNetProfitViewMode}
                        />
                    ) : (
                        <ViewModePicker
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                        />
                    )}
                    <ResolutionPicker currentTick={currentTick} />
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
                    netProfitViewMode={netProfitViewMode}
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
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenFacilities: Set<string>;
    viewMode: "normal" | "percent";
    revenueType: RevenueType;
    netProfitViewMode: NetProfitViewMode;
}

function RevenuesChart({
    chartData,
    isLoading,
    isError,
    hiddenFacilities,
    viewMode,
    revenueType,
    netProfitViewMode,
}: RevenuesChartProps) {
    const getColor = useAssetColorGetter();

    // Custom color getter for breakdown mode
    const getBreakdownColor = useCallback((key: string) => {
        if (key === "baseline") return "#9ca3af"; // gray-400
        if (key === "profit") return "#22c55e"; // green-500
        if (key === "loss") return "#ef4444"; // red-500
        return "#000000";
    }, []);

    // Create a composite filter that combines non-zero filtering with visibility filtering
    const filterDataKeys = useMemo(() => {
        // For net-profit view, use includeAllSeries since we have aggregated values
        // For breakdown mode, also use includeAllSeries to show all three series
        // filterNonZeroSeries only keeps values > 0, which filters out negative values
        const baseFilter =
            revenueType === "net-profit"
                ? includeAllSeries
                : filterNonZeroSeries;

        if (hiddenFacilities.size === 0) {
            return baseFilter;
        }

        const excludeFilter = createExcludeKeysFilter(
            Array.from(hiddenFacilities),
        );

        // Combine both filters: must pass base filter AND not be hidden
        return (key: string, data: unknown[]) => {
            return baseFilter(key, data) && excludeFilter(key);
        };
    }, [hiddenFacilities, revenueType]);

    // Transform data for percent view if needed
    const transformedData: Array<Record<string, unknown>> = useMemo(() => {
        if (viewMode === "normal" || !chartData || chartData.length === 0) {
            return chartData;
        }

        // For percent view, calculate percentage based on total
        return chartData.map((dataPoint) => {
            const dp = dataPoint as Record<string, unknown>;
            const result: Record<string, unknown> = {
                tick: typeof dp.tick === "number" ? dp.tick : 0,
            };

            // Calculate total for this datapoint
            let total = 0;
            Object.keys(dp).forEach((key) => {
                if (key !== "tick") {
                    const val = typeof dp[key] === "number" ? dp[key] : 0;
                    total += Math.abs((val as number) || 0);
                }
            });

            Object.keys(dp).forEach((key) => {
                if (key === "tick") return;

                const val = typeof dp[key] === "number" ? dp[key] : 0;
                const value = (val as number) || 0;
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

    const chartConfig: TimeSeriesChartConfig = useMemo(() => {
        const isBreakdownMode =
            revenueType === "net-profit" && netProfitViewMode === "breakdown";
        const isNetMode =
            revenueType === "net-profit" && netProfitViewMode === "net";

        return {
            chartVariant: "area",
            stacked: true,
            height: 400,
            showBrush: true,
            getColor: isBreakdownMode ? getBreakdownColor : getColor,
            filterDataKeys,
            formatValue: (value: number) => <CashFlow amountPerTick={value} />,
            // Use gradient fill for the "net-profit" series only in net mode
            gradientKeys: isNetMode ? ["net-profit"] : [],
        };
    }, [
        getColor,
        getBreakdownColor,
        filterDataKeys,
        revenueType,
        netProfitViewMode,
    ]);

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
                    onClick={() => onRevenueTypeChange("net-profit")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        revenueType === "net-profit"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    Net Profit
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

interface NetProfitViewModePickerProps {
    viewMode: NetProfitViewMode;
    onViewModeChange: (mode: NetProfitViewMode) => void;
}

function NetProfitViewModePicker({
    viewMode,
    onViewModeChange,
}: NetProfitViewModePickerProps) {
    return (
        <div>
            <label className="block text-sm font-medium mb-2">View Mode</label>
            <div className="flex gap-2">
                <button
                    onClick={() => onViewModeChange("net")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        viewMode === "net"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    Net
                </button>
                <button
                    onClick={() => onViewModeChange("breakdown")}
                    className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                        viewMode === "breakdown"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                >
                    Breakdown
                </button>
            </div>
        </div>
    );
}
