/** Power overview page - Electricity generation visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Zap, RefreshCw } from "lucide-react";
import {
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    AreaChart,
    Area,
    Brush,
} from "recharts";

import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout/GameLayout";
import { Card, CardTitle } from "@/components/ui";
import { useGameTick } from "@/hooks/useGameTick";
import { useCurrentChartData } from "@/hooks/useCharts";
import { Resolution } from "@/types/charts";
import { getAssetColor } from "@/lib/asset-colors";

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
    const [selectedResolutionIndex, setSelectedResolutionIndex] = useState(2);
    const dataPoints = selectedResolutionIndex === 0 ? 60 : 360;

    const selectedResolution = RESOLUTIONS[selectedResolutionIndex];

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-8">
                Power Generation
            </h1>

            <Card className="mb-6">
                <div className="space-y-4">
                    <ResolutionPicker
                        selectedResolutionIndex={selectedResolutionIndex}
                        onResolutionChange={setSelectedResolutionIndex}
                        currentTick={currentTick}
                    />
                </div>
            </Card>

            <Card className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-6 h-6 text-yellow-500" />
                    <CardTitle>Power Sources</CardTitle>
                </div>

                <PowerSourcesChart
                    currentTick={currentTick}
                    dataPoints={dataPoints}
                    resolution={selectedResolution.resolution}
                />
            </Card>
        </div>
    );
}

interface PowerSourcesChartProps {
    currentTick: number | undefined;
    dataPoints: number;
    resolution: Resolution;
}

// Get color for power source using asset color system
const getColorForSource = (source: string): string => getAssetColor(source);

function PowerSourcesChart({
    currentTick,
    dataPoints,
    resolution,
}: PowerSourcesChartProps) {
    const {
        chartData,
        isLoading: isChartLoading,
        isError,
    } = useCurrentChartData({
        chartType: "power-sources",
        currentTick,
        resolution,
        maxDatapoints: dataPoints,
    });

    // Memoize bar components
    const barComponents = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];

        // Extract power source keys from first data point (excluding 'tick')
        const powerSources = Object.keys(chartData[0]).filter(
            (key) => key !== "tick",
        );

        // Filter to only sources that have non-zero values
        return powerSources
            .filter((source) => {
                return chartData.some(
                    (dataPoint) =>
                        ((dataPoint as Record<string, any>)[source] ?? 0) > 0,
                );
            })
            .map((source) => (
                <Area
                    key={source}
                    dataKey={source}
                    stackId="power"
                    isAnimationActive={false}
                    // animationDuration={300}
                    fill={getColorForSource(source)}
                    fillOpacity={1}
                />
            ));
    }, [chartData]);

    if (isChartLoading) {
        return <ChartLoadingState />;
    }

    if (isError) {
        return (
            <div className="text-center py-12 text-alert-red">
                Failed to load data
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={400}>
            <AreaChart key={resolution} data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tick" tick={{ fontSize: 12 }} />
                <YAxis />
                <Brush dataKey="tick" height={30} stroke="#8884d8" />
                {barComponents}
                <Tooltip />
            </AreaChart>
        </ResponsiveContainer>
    );
}

function ChartLoadingState() {
    return (
        <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading data...
        </div>
    );
}

interface ResolutionOption {
    id: number;
    label: string;
    resolution: Resolution;
}

const RESOLUTIONS: ResolutionOption[] = [
    { id: 0, label: "4h", resolution: 1 },
    { id: 1, label: "24h", resolution: 1 },
    { id: 2, label: "6 days", resolution: 6 },
    { id: 3, label: "6 months", resolution: 36 },
    { id: 4, label: "3 years", resolution: 216 },
    { id: 5, label: "18 years", resolution: 1296 },
];

interface ResolutionPickerProps {
    selectedResolutionIndex: number;
    onResolutionChange: (index: number) => void;
    currentTick: number | undefined;
}

export function ResolutionPicker({
    selectedResolutionIndex,
    onResolutionChange,
    currentTick,
}: ResolutionPickerProps) {
    return (
        <div>
            <label className="block text-sm font-medium mb-2">Resolution</label>
            <div className="flex flex-wrap gap-2">
                {currentTick &&
                    RESOLUTIONS.filter(
                        // Only give the option of choosing a resolution if there is enough data for that graph view to make sense
                        (res) => currentTick > res.resolution * 360,
                    ).map((res) => (
                        <button
                            key={res.id}
                            onClick={() => onResolutionChange(res.id)}
                            className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                                selectedResolutionIndex === res.id
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                            }`}
                        >
                            {res.label}
                        </button>
                    ))}
            </div>
        </div>
    );
}
