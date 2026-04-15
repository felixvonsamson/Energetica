/** Resources overview page - Resource stocks visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { Package, TrendingUp, Warehouse, BarChart3, Funnel } from "lucide-react";
import { useState } from "react";

import {
    ResourcesChart,
    ResourcesOverviewTable,
} from "@/components/charts/resources-chart";
import { GameLayout } from "@/components/layout/game-layout";
import { CardContent, PageCard } from "@/components/ui";
import { ChartCard } from "@/components/ui/chart-card";
import { Label } from "@/components/ui/label";
import { ResolutionPicker } from "@/components/ui/resolution-picker";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { useResolution } from "@/contexts/resolution-context";
import { useChartData } from "@/hooks/use-charts";
import { useGameTick } from "@/hooks/use-game-tick";
import { useToggleSet } from "@/hooks/use-toggle-set";

export const Route = createFileRoute("/app/overviews/resources")({
    component: ResourcesOverviewPage,
    staticData: {
        title: "Resources Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) =>
                cap.has_warehouse
                    ? { unlocked: true }
                    : { unlocked: false, reason: "Build a Warehouse to unlock" },
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
                <li className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 shrink-0" />
                    <span>
                        Toggle between absolute view and percent of warehouse
                        capacity
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Funnel className="w-4 h-4 shrink-0" />
                    <span>
                        Use the table to toggle individual resources on/off in
                        the chart to focus on specific resources
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

const VIEW_MODE_OPTIONS = [
    { value: "percent", label: "% of Capacity" },
    { value: "normal", label: "Absolute" },
] as const;

function ResourcesOverviewContent() {
    const { currentTick } = useGameTick();
    const [viewMode, setViewMode] = useState<"normal" | "percent">("percent");
    const [hiddenResources, toggleResource] = useToggleSet<string>();
    const { selectedResolution } = useResolution();

    // Fetch absolute resource stocks for the table (always needed)
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

    // Fetch server-computed SoC (0-1 fraction) for the percent view
    const {
        chartData: resourcesSocData,
        isLoading: isSocLoading,
        isError: isSocError,
    } = useChartData({
        config: {
            chartType: "resources-soc",
            resolution: selectedResolution.resolution,
        },
        maxDatapoints: selectedResolution.datapoints,
    });

    const chartData =
        viewMode === "percent" ? resourcesSocData : resourcesData;
    const isChartLoading =
        viewMode === "percent" ? isSocLoading : isResourcesLoading;
    const isError = viewMode === "percent" ? isSocError : isResourcesError;

    return (
        <div className="py-4 md:p-8 space-y-6">
            <PageCard>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2">View Mode</Label>
                            <SegmentedPicker
                                value={viewMode}
                                onValueChange={(value) =>
                                    setViewMode(value as "normal" | "percent")
                                }
                            >
                                {VIEW_MODE_OPTIONS.map((option) => (
                                    <SegmentedPickerOption
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SegmentedPickerOption>
                                ))}
                            </SegmentedPicker>
                        </div>
                        <ResolutionPicker currentTick={currentTick} />
                    </div>
                </CardContent>
            </PageCard>

            <ChartCard
                icon={Package}
                iconClassName="text-primary"
                title="Resource Stocks"
            >
                <ResourcesChart
                    chartData={chartData}
                    isLoading={isChartLoading}
                    isError={isError}
                    hiddenResources={hiddenResources}
                    viewMode={viewMode}
                />

                <ResourcesOverviewTable
                    chartData={resourcesData}
                    hiddenResources={hiddenResources}
                    onToggleResource={toggleResource}
                />
            </ChartCard>
        </div>
    );
}
