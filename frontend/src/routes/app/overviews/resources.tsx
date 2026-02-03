/** Resources overview page - Resource stocks visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { Package, TrendingUp, Warehouse } from "lucide-react";

import { ResourcesChart } from "@/components/charts/resources-chart";
import { GameLayout } from "@/components/layout/game-layout";
import { Card, CardContent } from "@/components/ui";
import { ChartCard } from "@/components/ui/chart-card";
import { ResolutionPicker } from "@/components/ui/resolution-picker";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useChartData } from "@/hooks/useCharts";
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
        infoDialog: {
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
    } = useChartData({
        config: {
            chartType: "resources",
            resolution: selectedResolution.resolution,
        },
        maxDatapoints: selectedResolution.datapoints,
    });

    return (
        <div className="p-4 md:p-8">
            <Card className="mb-6">
                <CardContent>
                    <ResolutionPicker currentTick={currentTick} />
                </CardContent>
            </Card>

            <ChartCard
                icon={Package}
                iconClassName="text-primary"
                title="Resource Stocks"
            >
                <ResourcesChart
                    chartData={resourcesData}
                    isLoading={isResourcesLoading}
                    isError={isResourcesError}
                />
            </ChartCard>
        </div>
    );
}
