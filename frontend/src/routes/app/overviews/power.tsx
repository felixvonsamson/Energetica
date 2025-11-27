/**
 * Power overview page - Electricity generation visualization.
 */

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
import {
    useAggregatedPowerSourcesChart,
    _getCachedTickRanges,
} from "@/hooks/useCharts";
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

const RESOLUTIONS: Array<{
    id: number;
    label: string;
    resolution: Resolution;
}> = [
    { id: 0, label: "4h", resolution: 1 },
    { id: 1, label: "24h", resolution: 1 },
    { id: 2, label: "6 days", resolution: 6 },
    { id: 3, label: "6 months", resolution: 36 },
    { id: 4, label: "3 years", resolution: 216 },
    { id: 5, label: "18 years", resolution: 1296 },
];

function PowerOverviewContent() {
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
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Resolution
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {RESOLUTIONS.map((res) => (
                                <button
                                    key={res.id}
                                    onClick={() =>
                                        setSelectedResolutionIndex(res.id)
                                    }
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
                </div>
            </Card>

            <Card className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-6 h-6 text-yellow-500" />
                    <CardTitle>Power Sources</CardTitle>
                </div>

                <PowerSourcesChart
                    dataPoints={dataPoints}
                    resolution={selectedResolution.resolution}
                />
            </Card>
        </div>
    );
}

interface PowerSourcesChartProps {
    dataPoints: number;
    resolution: Resolution;
}

// Get color for power source using asset color system
const getColorForSource = (source: string): string => getAssetColor(source);

function PowerSourcesChart({ dataPoints, resolution }: PowerSourcesChartProps) {
    const { currentTick, isLoadingTick } = useGameTick();

    // Determine start tick
    // dataPoints is the number of datapoints, not ticks
    // Convert to ticks: dataPoints * resolution
    const res = Number(resolution);
    let leftmostTick = currentTick - dataPoints * res;
    let firstBarTick = Math.max(0, Math.floor(leftmostTick / res) * res);

    // Fetch and aggregate power sources data
    const params = isLoadingTick
        ? undefined
        : {
              resolution: resolution,
              start_tick: firstBarTick,
              count: Math.floor((currentTick - firstBarTick) / res),
          };
    const {
        data: powerSourcesData,
        isLoading: isChartLoading,
        isError,
    } = useAggregatedPowerSourcesChart(params);

    // Data is already in the right format for recharts
    const chartData = useMemo(() => {
        if (!powerSourcesData) return [];
        return powerSourcesData;
    }, [powerSourcesData]);

    // Memoize bar components
    const barComponents = useMemo(() => {
        if (!powerSourcesData || powerSourcesData.length === 0) return [];

        // Extract power source keys from first data point (excluding 'tick')
        const powerSources = Object.keys(powerSourcesData[0]).filter(
            (key) => key !== "tick",
        );

        // Filter to only sources that have non-zero values
        return powerSources
            .filter((source) => {
                return powerSourcesData.some(
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
    }, [powerSourcesData]);

    // Early returns after all hooks are called
    if (isLoadingTick || isChartLoading) {
        return <ChartLoadingState />;
    }

    if (isError) {
        return (
            <div className="text-center py-12 text-alert-red">
                Failed to load data
            </div>
        );
    }

    if (chartData.length === 0) {
        return null;
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
