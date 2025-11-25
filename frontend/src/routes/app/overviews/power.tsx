/**
 * Power overview page - Tests new chart hooks and tick management.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout/GameLayout";
import { Card, CardTitle } from "@/components/ui";
import { useGameTick } from "@/contexts/GameTickContext";
import {
    usePowerSourcesChart,
    usePowerSinksChart,
    useMostRecentPowerSourcesTick,
    useMostRecentPowerSinksTick,
    useSmartPowerSourcesChart,
    useSmartPowerSinksChart,
} from "@/hooks/useCharts";

export const Route = createFileRoute("/app/overviews/power")({
    component: PowerOverviewPage,
    staticData: { title: "Power Overview" },
});

type Resolution = "1" | "6" | "36" | "216" | "1296";

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
    const [resolution, setResolution] = useState<Resolution>("6");
    const [dataPoints, setDataPoints] = useState(100);
    const { currentTick } = useGameTick();

    const mostRecentSourcesTick = useMostRecentPowerSourcesTick(resolution);
    const mostRecentSinksTick = useMostRecentPowerSinksTick(resolution);

    // Convert resolution to number
    const resolutionNum = parseInt(resolution, 10);

    // Determine start tick - use most recent cached or go back from current
    let startTick = Math.max(
        currentTick - dataPoints,
        mostRecentSourcesTick
            ? mostRecentSourcesTick - dataPoints
            : currentTick - dataPoints,
    );

    // Align start_tick to resolution (must be a multiple of resolution)
    startTick = Math.floor(startTick / resolutionNum) * resolutionNum;

    // Fetch power sources data
    const {
        data: powerSourcesData,
        isLoading: isSourcesLoading,
        isError: isSourcesError,
        status: sourcesStatus,
    } = usePowerSourcesChart({
        resolution,
        start_tick: startTick,
        count: dataPoints,
    });

    // Fetch power sinks data
    const {
        data: powerSinksData,
        isLoading: isSinksLoading,
        isError: isSinksError,
        status: sinksStatus,
    } = usePowerSinksChart({
        resolution,
        start_tick: startTick,
        count: dataPoints,
    });

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-8">
                Power Overview
            </h1>

            {/* Control Panel */}
            <Card className="mb-6">
                <CardTitle>Chart Controls</CardTitle>
                <div className="space-y-4">
                    {/* Current Tick Display */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-bone dark:bg-dark-bg-secondary p-4 rounded-lg">
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                Current Server Tick
                            </div>
                            <div className="text-2xl font-bold text-primary">
                                {currentTick}
                            </div>
                        </div>

                        <div className="bg-bone dark:bg-dark-bg-secondary p-4 rounded-lg">
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                Most Recent Cached (Sources)
                            </div>
                            <div className="text-2xl font-bold text-brand-green">
                                {mostRecentSourcesTick ?? "—"}
                            </div>
                        </div>

                        <div className="bg-bone dark:bg-dark-bg-secondary p-4 rounded-lg">
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                Most Recent Cached (Sinks)
                            </div>
                            <div className="text-2xl font-bold text-brand-green">
                                {mostRecentSinksTick ?? "—"}
                            </div>
                        </div>
                    </div>

                    {/* Resolution Selector */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Resolution
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {(
                                ["1", "6", "36", "216", "1296"] as Resolution[]
                            ).map((res) => (
                                <button
                                    key={res}
                                    onClick={() => setResolution(res)}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                        resolution === res
                                            ? "bg-brand-green text-white"
                                            : "bg-bone dark:bg-dark-bg-secondary text-primary hover:bg-gray-300 dark:hover:bg-gray-700"
                                    }`}
                                >
                                    {res}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Data Points Slider */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Data Points: {dataPoints}
                        </label>
                        <input
                            type="range"
                            min="10"
                            max="500"
                            step="10"
                            value={dataPoints}
                            onChange={(e) =>
                                setDataPoints(Number(e.target.value))
                            }
                            className="w-full"
                        />
                    </div>

                    {/* Query Info */}
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Querying from tick <b>{startTick}</b> for{" "}
                        <b>{dataPoints} points</b>
                    </div>

                    {/* Debug Info */}
                    <div className="bg-bone dark:bg-dark-bg-secondary p-3 rounded text-xs font-mono">
                        <div>
                            Sources Status:{" "}
                            <span className="font-bold">{sourcesStatus}</span>
                        </div>
                        <div>
                            Sinks Status:{" "}
                            <span className="font-bold">{sinksStatus}</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Power Sources Chart */}
            <Card className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-6 h-6 text-yellow-500" />
                    <CardTitle>Power Sources</CardTitle>
                </div>

                {isSourcesLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                        Loading power sources data...
                    </div>
                ) : isSourcesError ? (
                    <div className="text-center py-8 text-alert-red">
                        Failed to load power sources data
                    </div>
                ) : powerSourcesData ? (
                    <div className="space-y-4">
                        {/* Metadata */}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="bg-bone dark:bg-dark-bg-secondary p-3 rounded">
                                <div className="text-gray-600 dark:text-gray-400">
                                    Start Tick
                                </div>
                                <div className="font-bold">
                                    {powerSourcesData.start_tick}
                                </div>
                            </div>
                            <div className="bg-bone dark:bg-dark-bg-secondary p-3 rounded">
                                <div className="text-gray-600 dark:text-gray-400">
                                    Data Points
                                </div>
                                <div className="font-bold">
                                    {powerSourcesData.count}
                                </div>
                            </div>
                            <div className="bg-bone dark:bg-dark-bg-secondary p-3 rounded">
                                <div className="text-gray-600 dark:text-gray-400">
                                    Resolution
                                </div>
                                <div className="font-bold">
                                    {powerSourcesData.resolution}
                                </div>
                            </div>
                        </div>

                        {/* Series Data */}
                        <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-300 dark:border-gray-600">
                                        <th className="text-left py-2 px-2">
                                            Source
                                        </th>
                                        <th className="text-right py-2 px-2">
                                            Data Points
                                        </th>
                                        <th className="text-right py-2 px-2">
                                            Latest Value
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(
                                        powerSourcesData.series,
                                    ).map(([source, values]) => (
                                        <tr
                                            key={source}
                                            className="border-b border-gray-200 dark:border-gray-700 hover:bg-bone dark:hover:bg-dark-bg-secondary"
                                        >
                                            <td className="py-2 px-2">
                                                {source}
                                            </td>
                                            <td className="text-right py-2 px-2">
                                                {values.length}
                                            </td>
                                            <td className="text-right py-2 px-2 font-medium">
                                                {(
                                                    values[values.length - 1] ??
                                                    0
                                                ).toFixed(2)}{" "}
                                                MW
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : null}
            </Card>

            {/* Power Sinks Chart */}
            <Card>
                <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="w-6 h-6 text-red-500" />
                    <CardTitle>Power Sinks</CardTitle>
                </div>

                {isSinksLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                        Loading power sinks data...
                    </div>
                ) : isSinksError ? (
                    <div className="text-center py-8 text-alert-red">
                        Failed to load power sinks data
                    </div>
                ) : powerSinksData ? (
                    <div className="space-y-4">
                        {/* Metadata */}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="bg-bone dark:bg-dark-bg-secondary p-3 rounded">
                                <div className="text-gray-600 dark:text-gray-400">
                                    Start Tick
                                </div>
                                <div className="font-bold">
                                    {powerSinksData.start_tick}
                                </div>
                            </div>
                            <div className="bg-bone dark:bg-dark-bg-secondary p-3 rounded">
                                <div className="text-gray-600 dark:text-gray-400">
                                    Data Points
                                </div>
                                <div className="font-bold">
                                    {powerSinksData.count}
                                </div>
                            </div>
                            <div className="bg-bone dark:bg-dark-bg-secondary p-3 rounded">
                                <div className="text-gray-600 dark:text-gray-400">
                                    Resolution
                                </div>
                                <div className="font-bold">
                                    {powerSinksData.resolution}
                                </div>
                            </div>
                        </div>

                        {/* Series Data */}
                        <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-300 dark:border-gray-600">
                                        <th className="text-left py-2 px-2">
                                            Sink
                                        </th>
                                        <th className="text-right py-2 px-2">
                                            Data Points
                                        </th>
                                        <th className="text-right py-2 px-2">
                                            Latest Value
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(powerSinksData.series).map(
                                        ([sink, values]) => (
                                            <tr
                                                key={sink}
                                                className="border-b border-gray-200 dark:border-gray-700 hover:bg-bone dark:hover:bg-dark-bg-secondary"
                                            >
                                                <td className="py-2 px-2">
                                                    {sink}
                                                </td>
                                                <td className="text-right py-2 px-2">
                                                    {values.length}
                                                </td>
                                                <td className="text-right py-2 px-2 font-medium">
                                                    {(
                                                        values[
                                                            values.length - 1
                                                        ] ?? 0
                                                    ).toFixed(2)}{" "}
                                                    MW
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : null}
            </Card>
        </div>
    );
}
