/** Power overview page - Electricity generation visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { Zap, TrendingUp, TrendingDown, Funnel } from "lucide-react";
import { useState, useMemo } from "react";

import {
    TimeSeriesChart,
    ResolutionPicker,
    PowerOverviewTable,
    type TimeSeriesChartConfig,
} from "@/components/charts";
import { GameLayout } from "@/components/layout/game-layout";
import { Card, CardContent } from "@/components/ui";
import { ChartCard } from "@/components/ui/chart-card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
import { useChartFilters } from "@/hooks/useChartFilters";
import { useCurrentChartData } from "@/hooks/useCharts";
import { useGameTick } from "@/hooks/useGameTick";
import { useToggleSet } from "@/hooks/useToggleSet";
import { formatPower } from "@/lib/format-utils";
import { ChartType } from "@/types/charts";

export const Route = createFileRoute("/app/overviews/power")({
    component: PowerOverviewPage,
    staticData: {
        title: "Power Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
        },
        infoModal: {
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

function PowerOverviewContent() {
    const { currentTick } = useGameTick();
    const [chartType, setChartType] = useState<ChartType>("power-sources");
    const [hiddenSources, toggleSource] = useToggleSet<string>();
    const [hiddenSinks, toggleSink] = useToggleSet<string>();

    const { selectedResolution } = useTimeMode();
    // Fetch chart data to share between chart and table
    const {
        chartData,
        isLoading: isChartLoading,
        isError,
    } = useCurrentChartData({
        chartType,
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
    });

    // Get the appropriate hidden set and toggle function based on chart type
    const hiddenFacilities =
        chartType === "power-sources" ? hiddenSources : hiddenSinks;
    const toggleFacility =
        chartType === "power-sources" ? toggleSource : toggleSink;

    return (
        <div className="p-4 md:p-8">
            <Card className="mb-6">
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2">Chart Type</Label>
                            <Tabs
                                value={chartType}
                                onValueChange={(value) =>
                                    setChartType(value as ChartType)
                                }
                            >
                                <TabsList>
                                    {CHART_TYPE_OPTIONS.map((option) => (
                                        <TabsTrigger
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </div>
                        <ResolutionPicker currentTick={currentTick} />
                    </div>
                </CardContent>
            </Card>

            <ChartCard
                icon={Zap}
                iconClassName="text-primary"
                title={
                    chartType === "power-sources"
                        ? "Power Generation"
                        : "Power Consumption"
                }
                className="mb-6"
            >
                <PowerChart
                    chartData={chartData}
                    isLoading={isChartLoading}
                    isError={isError}
                    hiddenFacilities={hiddenFacilities}
                />

                <div className="mt-6">
                    <PowerOverviewTable
                        chartType={chartType}
                        chartData={chartData}
                        resolution={selectedResolution.resolution}
                        hiddenFacilities={hiddenFacilities}
                        onToggleFacility={toggleFacility}
                    />
                </div>
            </ChartCard>
        </div>
    );
}

interface PowerChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenFacilities: Set<string>;
}

function PowerChart({
    chartData,
    isLoading,
    isError,
    hiddenFacilities,
}: PowerChartProps) {
    const getColor = useAssetColorGetter();
    const filterDataKeys = useChartFilters(hiddenFacilities);

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: "area",
            stacked: true,
            showBrush: true,
            getColor,
            filterDataKeys,
            formatTooltip: (value: number, name: string) => [
                formatPower(value),
                name,
            ],
            formatValue: formatPower,
            formatYAxis: (value: number) => formatPower(value),
        }),
        [getColor, filterDataKeys],
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
