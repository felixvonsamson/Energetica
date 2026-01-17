/** Storage overview page - Energy storage visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { Battery, TrendingUp, BarChart3, Funnel } from "lucide-react";
import { useState, useMemo } from "react";

import {
    TimeSeriesChart,
    ResolutionPicker,
    StorageOverviewTable,
    type TimeSeriesChartConfig,
} from "@/components/charts";
import { GameLayout } from "@/components/layout/game-layout";
import {
    Card,
    CardContent,
    ButtonGroup,
    type ButtonGroupOption,
} from "@/components/ui";
import { ChartCard } from "@/components/ui/chart-card";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
import { useChartFilters } from "@/hooks/useChartFilters";
import { useCurrentChartData } from "@/hooks/useCharts";
import { useFacilities } from "@/hooks/useFacilities";
import { useGameTick } from "@/hooks/useGameTick";
import { useToggleSet } from "@/hooks/useToggleSet";
import { formatEnergy } from "@/lib/format-utils";

export const Route = createFileRoute("/app/overviews/storage")({
    component: StorageOverviewPage,
    staticData: {
        title: "Storage Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) => cap.has_storage,
        },
        infoModal: {
            contents: <StorageOverviewHelp />,
        },
    },
});

function StorageOverviewHelp() {
    return (
        <div className="space-y-3">
            <p>
                This page shows the energy stored in your storage facilities
                over time.
            </p>
            <ul className="list-none space-y-1 ml-4">
                <li className="flex items-center gap-2">
                    <Battery className="w-4 h-4 shrink-0" />
                    <span>
                        View stored energy levels for batteries, pumped hydro,
                        and other storage facilities
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    <span>
                        Track charging and discharging patterns to optimize
                        energy management
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 shrink-0" />
                    <span>
                        Toggle between normal view (absolute energy) and percent
                        view (% of capacity)
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Funnel className="w-4 h-4 shrink-0" />
                    <span>
                        Use the table to toggle individual storage facilities
                        on/off in the chart to focus on specific facilities.
                    </span>
                </li>
            </ul>
        </div>
    );
}

function StorageOverviewPage() {
    return (
        <GameLayout>
            <StorageOverviewContent />
        </GameLayout>
    );
}

const VIEW_MODE_OPTIONS: ButtonGroupOption<"normal" | "percent">[] = [
    { value: "normal", label: "Stored Capacity" },
    { value: "percent", label: "State of Charge" },
];

function StorageOverviewContent() {
    const { currentTick } = useGameTick();
    const [viewMode, setViewMode] = useState<"normal" | "percent">("normal");
    const [hiddenFacilities, toggleFacility] = useToggleSet<string>();

    const { selectedResolution } = useTimeMode();

    // Fetch chart data to share between chart and table
    const {
        chartData,
        isLoading: isChartLoading,
        isError,
    } = useCurrentChartData({
        chartType: "storage-level",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
    });

    return (
        <div className="p-4 md:p-8">
            <Card className="mb-6">
                <CardContent>
                    <div className="space-y-4">
                        <ButtonGroup
                            label="View Mode"
                            value={viewMode}
                            options={VIEW_MODE_OPTIONS}
                            onChange={setViewMode}
                        />
                        <ResolutionPicker currentTick={currentTick} />
                    </div>
                </CardContent>
            </Card>

            <ChartCard
                icon={Battery}
                iconClassName="text-primary"
                title="Stored Energy"
                className="mb-6"
            >
                <StorageChart
                    chartData={chartData}
                    isLoading={isChartLoading}
                    isError={isError}
                    hiddenFacilities={hiddenFacilities}
                    viewMode={viewMode}
                />

                <div className="mt-6">
                    <StorageOverviewTable
                        chartData={chartData}
                        hiddenFacilities={hiddenFacilities}
                        onToggleFacility={toggleFacility}
                    />
                </div>
            </ChartCard>
        </div>
    );
}

interface StorageChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenFacilities: Set<string>;
    viewMode: "normal" | "percent";
}

function StorageChart({
    chartData,
    isLoading,
    isError,
    hiddenFacilities,
    viewMode,
}: StorageChartProps) {
    const getColor = useAssetColorGetter();
    const { data: facilities } = useFacilities();
    const filterDataKeys = useChartFilters(hiddenFacilities);

    // Transform data for percent view if needed
    const transformedData: Array<Record<string, unknown>> = useMemo(() => {
        if (viewMode === "normal" || !chartData || chartData.length === 0) {
            return chartData;
        }

        // For percent view, we need to calculate the percentage of capacity for each facility
        // This requires knowing the max capacity for each facility
        // For now, we'll calculate percentage based on the max value in the series
        return chartData.map((dataPoint) => {
            const dp = dataPoint as Record<string, unknown>;
            const result: Record<string, unknown> = {
                tick: typeof dp.tick === "number" ? dp.tick : 0,
            };

            if (!facilities) return result;

            Object.keys(dp).forEach((key) => {
                if (key === "tick") return;

                const maxValue = facilities.storage_facilities.reduce(
                    (runningMax, facility) =>
                        facility.facility === key
                            ? runningMax + facility.storage_capacity
                            : runningMax,
                    0,
                );

                const currentVal = typeof dp[key] === "number" ? dp[key] : 0;
                if (maxValue !== undefined && maxValue > 0) {
                    result[key] =
                        (((currentVal as number) || 0) / maxValue) * 100;
                } else {
                    result[key] = 0;
                }
            });

            return result;
        });
    }, [chartData, facilities, viewMode]);

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: viewMode === "normal" ? "area" : "line",
            stacked: viewMode === "normal" ? true : false,
            showBrush: true,
            getColor,
            filterDataKeys,
            formatValue:
                viewMode === "normal"
                    ? formatEnergy
                    : (value: number) => `${value.toFixed(1)}%`,
            formatYAxis: (value: number) =>
                viewMode === "normal" ? formatEnergy(value) : `${value}%`,
        }),
        [viewMode, getColor, filterDataKeys],
    );

    return (
        <TimeSeriesChart
            data={transformedData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}
