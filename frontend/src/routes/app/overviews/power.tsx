/**
 * Power overview page - Electricity generation visualization.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Zap, RefreshCw } from "lucide-react";
import {
    BarChart,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    Bar,
    AreaChart,
    Area,
} from "recharts";

import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout/GameLayout";
import { Card, CardTitle } from "@/components/ui";
import { useGameTick } from "@/contexts/GameTickContext";
import {
    useAggregatedPowerSourcesChart,
    _getCachedTickRanges,
} from "@/hooks/useCharts";
import { Resolution, toStringResolution } from "@/types/charts";
import { queryClient } from "@/lib/query-client";

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
    // const [dataPoints, setDataPoints] = useState(60);
    const [selectedResolutionIndex, setSelectedResolutionIndex] = useState(2);
    const dataPoints = selectedResolutionIndex === 0 ? 60 : 360;

    const selectedResolution = RESOLUTIONS[selectedResolutionIndex];

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-8">
                Power Generation
            </h1>

            <Card className="mb-6 p-4 bg-slate-50">
                <h2 className="text-sm font-semibold mb-3 text-slate-700">
                    Cache Coverage (Resolution {selectedResolution.resolution})
                </h2>
                <CacheRangesVisualization
                    resolution={selectedResolution.resolution}
                />
            </Card>

            <Card className="mb-6">
                <div className="space-y-4">
                    {/* <div>
                        <label className="block text-sm font-medium mb-2">
                            Data Points: {dataPoints}
                        </label>
                        <input
                            type="range"
                            min="60"
                            max="360"
                            step="60"
                            value={dataPoints}
                            onChange={(e) =>
                                setDataPoints(Number(e.target.value))
                            }
                            className="w-full"
                        />
                    </div> */}
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
                    fill={
                        "#" +
                        ((Math.random() * 0xffffff) << 0)
                            .toString(16)
                            .padStart(6, "0")
                    }
                />
            ));
    }, [powerSourcesData]);

    // Early returns after all hooks are called
    if (isLoadingTick) {
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
            <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tick" tick={{ fontSize: 12 }} />
                <YAxis />
                {barComponents}
                <Tooltip />
            </AreaChart>
        </ResponsiveContainer>
    );
}

interface CacheRangesVisualizationProps {
    resolution: Resolution;
}

function CacheRangesVisualization({
    resolution,
}: CacheRangesVisualizationProps) {
    const [cacheVersion, setCacheVersion] = useState(0);

    useEffect(() => {
        const unsubscribe = queryClient.getQueryCache().subscribe(() => {
            setCacheVersion((v) => v + 1);
        });
        return unsubscribe;
    }, []);

    const ranges = useMemo(
        () => _getCachedTickRanges(queryClient, "power-sources", resolution),
        [resolution, cacheVersion],
    );

    if (ranges.length === 0) {
        return (
            <div className="text-sm text-slate-500 italic">
                No data cached yet
            </div>
        );
    }

    // Calculate the overall range to visualize
    const minTick = Math.min(...ranges.map((r) => r.start_tick));
    const maxTick = Math.max(
        ...ranges.map((r) => r.start_tick + r.count * resolution),
    );
    const totalSpan = maxTick - minTick;

    return (
        <div className="space-y-2">
            {/* Timeline visualization */}
            <div className="space-y-1">
                {ranges.map((range, idx) => {
                    const start =
                        ((range.start_tick - minTick) / totalSpan) * 100;
                    const width =
                        ((range.count * resolution) / totalSpan) * 100;
                    const endTick = range.start_tick + range.count * resolution;
                    return (
                        <div
                            key={idx}
                            className="relative h-6 bg-slate-200 rounded border border-slate-300 overflow-hidden"
                        >
                            <div
                                className="absolute h-full bg-emerald-500 hover:bg-emerald-600 transition-colors group"
                                style={{
                                    left: `${start}%`,
                                    width: `${width}%`,
                                }}
                                title={`Ticks ${range.start_tick}-${endTick} (${range.count} points)`}
                            >
                                {width > 12 && (
                                    <span className="text-xs text-white font-semibold px-1 leading-6 opacity-75 group-hover:opacity-100">
                                        {range.start_tick}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Details */}
            <div className="text-xs text-slate-600 space-y-1">
                <p>
                    <span className="font-semibold">Total span:</span> {minTick}{" "}
                    → {maxTick} ({totalSpan} ticks)
                </p>
                <p>
                    <span className="font-semibold">Ranges:</span>{" "}
                    {ranges.length}
                </p>
                {ranges.length <= 5 && (
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                        {ranges.map((range, idx) => (
                            <li key={idx}>
                                {range.start_tick}-
                                {range.start_tick + range.count * resolution} (
                                {range.count} pts)
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
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
