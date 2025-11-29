/** Power overview page - Electricity generation visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Zap } from "lucide-react";

import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout/GameLayout";
import { Card, CardTitle } from "@/components/ui";
import { useGameTick } from "@/hooks/useGameTick";
import { useCurrentChartData } from "@/hooks/useCharts";
import { Resolution, ChartType } from "@/types/charts";
import { getAssetColor } from "@/lib/asset-colors";
import {
    TimeSeriesChart,
    ResolutionPicker,
    filterNonZeroSeries,
    type ResolutionOption,
    type TimeSeriesChartConfig,
} from "@/components/charts";

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
    const dataPoints = selectedResolutionIndex === 0 ? 60 : 360;

    const selectedResolution = RESOLUTIONS[selectedResolutionIndex];

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
                    currentTick={currentTick}
                    dataPoints={dataPoints}
                    resolution={selectedResolution.resolution}
                    chartType={chartType}
                />
            </Card>
        </div>
    );
}

interface PowerChartProps {
    currentTick: number | undefined;
    dataPoints: number;
    resolution: Resolution;
    chartType: ChartType;
}

function PowerChart({
    currentTick,
    dataPoints,
    resolution,
    chartType,
}: PowerChartProps) {
    const {
        chartData,
        isLoading: isChartLoading,
        isError,
    } = useCurrentChartData({
        chartType,
        currentTick,
        resolution,
        maxDatapoints: dataPoints,
    });

    const chartConfig: TimeSeriesChartConfig = {
        chartVariant: "area",
        stacked: true,
        height: 400,
        showBrush: true,
        getColor: getAssetColor,
        filterDataKeys: filterNonZeroSeries,
    };

    return (
        <TimeSeriesChart
            data={chartData}
            config={chartConfig}
            isLoading={isChartLoading}
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
