/** Resources overview page - Resource stocks visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { useMemo } from "react";

import {
    TimeSeriesChart,
    ResolutionPicker,
    filterNonZeroSeries,
    type TimeSeriesChartConfig,
} from "@/components/charts";
import { GameLayout } from "@/components/layout/GameLayout";
import { Card, CardTitle } from "@/components/ui";
import { useTimeMode } from "@/contexts/TimeModeContext";
import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
import { useCurrentChartData } from "@/hooks/useCharts";
import { useGameTick } from "@/hooks/useGameTick";

export const Route = createFileRoute("/app/overviews/resources")({
    component: ResourcesOverviewPage,
    staticData: {
        title: "Resources Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) => cap.has_warehouse,
        },
    },
});

function ResourcesOverviewPage() {
    return (
        <GameLayout>
            <ResourcesOverviewContent />
        </GameLayout>
    );
}

function ResourcesOverviewContent() {
    const { currentTick } = useGameTick();
    const { selectedResolution } = useTimeMode();

    // Fetch resources chart data
    const {
        chartData: resourcesData,
        isLoading: isResourcesLoading,
        isError: isResourcesError,
    } = useCurrentChartData({
        chartType: "resources",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
    });

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-8">
                Resources Overview
            </h1>

            <Card className="mb-6">
                <ResolutionPicker currentTick={currentTick} />
            </Card>

            <Card>
                <div className="flex items-center gap-2 mb-4">
                    <Package className="w-6 h-6 text-amber-600" />
                    <CardTitle>Resource Stocks</CardTitle>
                </div>

                <ResourcesChart
                    chartData={resourcesData}
                    isLoading={isResourcesLoading}
                    isError={isResourcesError}
                />
            </Card>
        </div>
    );
}

interface ResourcesChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
}

function ResourcesChart({
    chartData,
    isLoading,
    isError,
}: ResourcesChartProps) {
    const getColor = useAssetColorGetter();

    const formatValue = (value: number): string => {
        // Format as tons
        const abs = Math.abs(value);
        if (abs >= 1e9) {
            return `${(value / 1e9).toFixed(2)} Gt`;
        } else if (abs >= 1e6) {
            return `${(value / 1e6).toFixed(2)} Mt`;
        } else if (abs >= 1e3) {
            return `${(value / 1e3).toFixed(2)} kt`;
        } else {
            return `${value.toFixed(2)} t`;
        }
    };

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: "area",
            stacked: false,
            height: 400,
            showBrush: true,
            getColor,
            filterDataKeys: filterNonZeroSeries,
            formatValue,
        }),
        [getColor],
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
