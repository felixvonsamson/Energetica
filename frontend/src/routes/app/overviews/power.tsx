/** Power overview page - Electricity generation visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { Zap, TrendingUp, TrendingDown, Funnel } from "lucide-react";
import { useState } from "react";

import {
    PowerChart,
    PowerOverviewTable,
    type PowerChartViewMode,
} from "@/components/charts/power-chart";
import { GameLayout } from "@/components/layout/game-layout";
import { CardContent, PageCard } from "@/components/ui";
import { ChartCard } from "@/components/ui/chart-card";
import { Label } from "@/components/ui/label";
import { ResolutionPicker } from "@/components/ui/resolution-picker";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useChartData } from "@/hooks/use-charts";
import { useGameTick } from "@/hooks/use-game-tick";
import { useToggleSet } from "@/hooks/use-toggle-set";

export const Route = createFileRoute("/app/overviews/power")({
    component: PowerOverviewPage,
    staticData: {
        title: "Power Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => ({ unlocked: true }),
        },
        infoDialog: {
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

const CHART_TYPE_OPTIONS = [
    { value: "power-sources", label: "Generation (Sources)" },
    { value: "power-sinks", label: "Consumption (Sinks)" },
] as const;

const VIEW_MODE_OPTIONS = [
    { value: "absolute", label: "Absolute" },
    { value: "percent", label: "Percentage" },
] as const;

function PowerOverviewContent() {
    const { currentTick } = useGameTick();
    const [chartType, setChartType] = useState<"power-sources" | "power-sinks">(
        "power-sources",
    );
    const [viewMode, setViewMode] = useState<PowerChartViewMode>("absolute");
    const [hiddenSources, toggleSource] = useToggleSet<string>();
    const [hiddenSinks, toggleSink] = useToggleSet<string>();

    const { selectedResolution } = useTimeMode();
    // Fetch chart data to share between chart and table
    const {
        chartData,
        isLoading: isChartLoading,
        isError,
    } = useChartData({
        config: { chartType, resolution: selectedResolution.resolution },
        maxDatapoints: selectedResolution.datapoints,
    });

    // Get the appropriate hidden set and toggle function based on chart type
    const hiddenFacilities =
        chartType === "power-sources" ? hiddenSources : hiddenSinks;
    const toggleFacility =
        chartType === "power-sources" ? toggleSource : toggleSink;

    return (
        <div className="py-4 md:p-8 space-y-6">
            <PageCard>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2">Chart Type</Label>
                            <SegmentedPicker
                                value={chartType}
                                onValueChange={(value) => setChartType(value)}
                            >
                                {CHART_TYPE_OPTIONS.map((option) => (
                                    <SegmentedPickerOption
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SegmentedPickerOption>
                                ))}
                            </SegmentedPicker>
                        </div>
                        <div>
                            <Label className="mb-2">Display Mode</Label>
                            <SegmentedPicker
                                value={viewMode}
                                onValueChange={(value) => setViewMode(value)}
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
                icon={Zap}
                iconClassName="text-primary"
                title={
                    chartType === "power-sources"
                        ? "Power Generation"
                        : "Power Consumption"
                }
            >
                <PowerChart
                    chartType={chartType}
                    chartData={chartData}
                    isLoading={isChartLoading}
                    isError={isError}
                    hiddenFacilities={hiddenFacilities}
                    viewMode={viewMode}
                />

                <PowerOverviewTable
                    chartType={chartType}
                    chartData={chartData}
                    resolution={selectedResolution.resolution}
                    hiddenFacilities={hiddenFacilities}
                    onToggleFacility={toggleFacility}
                />
            </ChartCard>
        </div>
    );
}
