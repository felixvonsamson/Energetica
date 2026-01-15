/** Power overview page - Electricity generation visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { Zap, TrendingUp, TrendingDown, Funnel } from "lucide-react";
import { useState, useMemo, useCallback } from "react";

import {
    TimeSeriesChart,
    ResolutionPicker,
    PowerOverviewTable,
    filterNonZeroSeries,
    createExcludeKeysFilter,
    type TimeSeriesChartConfig,
} from "@/components/charts";
import { GameLayout } from "@/components/layout/game-layout";
import { Card, CardContent, CardTitle } from "@/components/ui";
import { Label } from "@/components/ui/label";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
import { useCurrentChartData } from "@/hooks/useCharts";
import { useGameTick } from "@/hooks/useGameTick";
import { formatPower } from "@/lib/format-utils";
import { ChartType } from "@/types/charts";

export const Route = createFileRoute("/app/overviews/power")({
    component: PowerOverviewPage,
    staticData: {
        title: "Power Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
        },
        infoModal: {
            contents: <PowerOverviewHelp />,
        },
    },
});

function PowerOverviewHelp() {
    return (
        <div className="space-y-3">
            <p>
                This page shows the electricity generation and consumption of
                your facilities over time.
            </p>
            <ul className="list-none space-y-1 ml-4">
                <li className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    <span>
                        <b>Power Generation (Sources):</b> View electricity
                        produced by your power facilities and electricity market
                        imports
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 shrink-0" />
                    <span>
                        <b>Power Consumption (Sinks):</b> View electricity
                        consumed by your facilities and electricity market
                        exports
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Funnel className="w-4 h-4 shrink-0" />
                    <span>
                        Use the table to toggle individual facilities on/off in
                        the chart
                    </span>
                </li>
            </ul>
            <p>Use different time resolutions to spot trends.</p>
        </div>
    );
}

function PowerOverviewPage() {
    return (
        <GameLayout>
            <PowerOverviewContent />
        </GameLayout>
    );
}

function PowerOverviewContent() {
    const { currentTick } = useGameTick();
    const [chartType, setChartType] = useState<ChartType>("power-sources");
    const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());
    const [hiddenSinks, setHiddenSinks] = useState<Set<string>>(new Set());

    const { selectedResolution } = useTimeMode();
    // Fetch chart data to share between chart and table
    const {
        chartData,
        isLoading: isChartLoading,
        isError,
    } = useCurrentChartData({
        chartType,
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
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
            <Card className="mb-6">
                <CardContent>
                    <div className="space-y-4">
                        <ChartTypePicker
                            chartType={chartType}
                            onChartTypeChange={setChartType}
                        />
                        <ResolutionPicker currentTick={currentTick} />
                    </div>
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardContent>
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
                </CardContent>
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
        return [
            filterNonZeroSeries,
            createExcludeKeysFilter(Array.from(hiddenFacilities)),
        ];
    }, [hiddenFacilities]);

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: "area",
            stacked: true,
            showBrush: true,
            getColor,
            filterDataKeys,
            formatTooltip: (value: number, name: string) => [
                formatPower(value),
                name,
            ],
            formatValue: formatPower,
            formatYAxis: (value: number) => formatPower(value),
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
            <Label className="mb-2">Chart Type</Label>
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
