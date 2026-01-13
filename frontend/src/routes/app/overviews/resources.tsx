/** Resources overview page - Resource stocks visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { Package, TrendingUp, Warehouse } from "lucide-react";
import { useMemo } from "react";

import {
    TimeSeriesChart,
    ResolutionPicker,
    filterNonZeroSeries,
    type TimeSeriesChartConfig,
} from "@/components/charts";
import { GameLayout } from "@/components/layout/game-layout";
import { Card, CardTitle } from "@/components/ui";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
import { useCurrentChartData } from "@/hooks/useCharts";
import { useGameTick } from "@/hooks/useGameTick";
import { formatMass } from "@/lib/format-utils";

export const Route = createFileRoute("/app/overviews/resources")({
    component: ResourcesOverviewPage,
    staticData: {
        title: "Resources Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) => cap.has_warehouse,
        },
        infoModal: {
            contents: <ResourcesOverviewHelp />,
        },
    },
});

function ResourcesOverviewHelp() {
    return (
        <div className="space-y-3">
            <p>
                This page shows your resource stocks (materials and fuels)
                stored in your warehouses over time.
            </p>
            <ul className="list-none space-y-1 ml-4">
                <li className="flex items-center gap-2">
                    <Package className="w-4 h-4 shrink-0" />
                    <span>
                        Track inventory levels of coal, gas, and uranium
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Warehouse className="w-4 h-4 shrink-0" />
                    <span>
                        Monitor resource consumption and production to avoid
                        running out
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    <span>
                        Use this data to plan purchases and sales using the
                        resource market
                    </span>
                </li>
            </ul>
            <p>
                Resources are consumed by certain power facilities and can be
                bought/sold on the resource market.
            </p>
        </div>
    );
}

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

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: "area",
            stacked: false,
            showBrush: true,
            getColor,
            filterDataKeys: [filterNonZeroSeries],
            formatValue: formatMass,
            formatYAxis: (value: number) => formatMass(value),
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
