/** Revenues overview page - Revenue and expenses visualization. */

import { createFileRoute } from "@tanstack/react-router";
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    PieChart,
    Funnel,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";

import {
    TimeSeriesChart,
    ResolutionPicker,
    CashFlowOverviewTable,
    type TimeSeriesChartConfig,
} from "@/components/charts";
import { GameLayout } from "@/components/layout/game-layout";
import { Card, CardContent, CashFlow } from "@/components/ui";
import { ChartCard } from "@/components/ui/chart-card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
import { useChartFilters } from "@/hooks/useChartFilters";
import { useCurrentChartData } from "@/hooks/useCharts";
import { useGameEngine } from "@/hooks/useGame";
import { useGameTick } from "@/hooks/useGameTick";
import { useToggleSet } from "@/hooks/useToggleSet";
import { formatCashFlow } from "@/lib/format-utils";

type RevenueType = "revenues" | "expenses" | "net-profit";
type NetProfitViewMode = "net" | "breakdown";

export const Route = createFileRoute("/app/overviews/cash-flow")({
    component: RevenuesOverviewPage,
    staticData: {
        title: "Cash Flow Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
        },
        infoModal: {
            contents: <CashFlowOverviewHelp />,
        },
    },
});

function CashFlowOverviewHelp() {
    return (
        <div className="space-y-3">
            <p>
                This page shows your revenues, expenses, and net profit over
                time from all your facilities.
            </p>
            <ul className="list-none space-y-1 ml-4">
                <li className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    <span>
                        <b>Revenues:</b> Money earned from industry, selling
                        electricity
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 shrink-0" />
                    <span>
                        <b>Expenses:</b> Operating costs, electricity imports
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 shrink-0" />
                    <span>
                        <b>Net Profit:</b> View overall profitability or see
                        breakdown of revenues vs expenses
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Funnel className="w-4 h-4 shrink-0" />
                    <span>
                        Use the table to toggle individual facilities on/off in
                        the charts.
                    </span>
                </li>
            </ul>
            <p>
                Toggle between normal and percent view to analyze your cash flow
                composition. Use different time resolutions to spot trends.
            </p>
        </div>
    );
}

function RevenuesOverviewPage() {
    return (
        <GameLayout>
            <RevenuesOverviewContent />
        </GameLayout>
    );
}

const REVENUE_TYPE_OPTIONS = [
    { value: "revenues", label: "Revenues" },
    { value: "expenses", label: "Expenses" },
    { value: "net-profit", label: "Net Profit" },
] as const;

const VIEW_MODE_OPTIONS = [
    { value: "normal", label: "Normal" },
    { value: "percent", label: "Percent" },
] as const;

const NET_PROFIT_VIEW_MODE_OPTIONS = [
    { value: "net", label: "Net" },
    { value: "breakdown", label: "Breakdown" },
] as const;

function RevenuesOverviewContent() {
    const { currentTick } = useGameTick();
    const [viewMode, setViewMode] = useState<"normal" | "percent">("normal");
    const [netProfitViewMode, setNetProfitViewMode] =
        useState<NetProfitViewMode>("net");
    const [revenueType, setRevenueType] = useState<RevenueType>("revenues");
    const [hiddenFacilities, toggleFacility] = useToggleSet<string>();
    const { selectedResolution } = useTimeMode();

    // Fetch both revenue and op-costs chart data
    const {
        chartData: revenuesData,
        isLoading: isRevenuesLoading,
        isError: isRevenuesError,
    } = useCurrentChartData({
        chartType: "revenues",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
    });

    const {
        chartData: opCostsData,
        isLoading: isOpCostsLoading,
        isError: isOpCostsError,
    } = useCurrentChartData({
        chartType: "op-costs",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
    });

    const isChartLoading = isRevenuesLoading || isOpCostsLoading;
    const isError = isRevenuesError || isOpCostsError;

    // Merge and filter data based on revenue type
    const filteredChartData = useMemo(() => {
        if (!revenuesData || revenuesData.length === 0) {
            return [];
        }

        // Create a map of ticks for easy merging
        const tickMap = new Map<number, Record<string, number>>();

        // Process revenues data
        revenuesData.forEach((dataPoint: Record<string, number>) => {
            const tick = dataPoint.tick;
            if (typeof tick !== "number") return;

            if (!tickMap.has(tick)) {
                tickMap.set(tick, { tick });
            }
            const result = tickMap.get(tick)!;

            Object.keys(dataPoint).forEach((key) => {
                if (key === "tick") return;

                const value = dataPoint[key] ?? 0;

                if (revenueType === "revenues") {
                    // Only include positive values from revenues
                    result[key] = value > 0 ? value : 0;
                } else if (revenueType === "expenses") {
                    // Only include negative values from revenues, displayed as positive
                    result[key] = value < 0 ? Math.abs(value) : 0;
                } else if (revenueType === "net-profit") {
                    if (netProfitViewMode === "net") {
                        // For "net": aggregate into single "net-profit" value
                        result["net-profit"] =
                            (result["net-profit"] || 0) + value;
                    } else {
                        // For "breakdown": track gross revenues and expenses separately
                        if (value > 0) {
                            result["gross-revenues"] =
                                (result["gross-revenues"] || 0) + value;
                        } else if (value < 0) {
                            result["total-expenses"] =
                                (result["total-expenses"] || 0) +
                                Math.abs(value);
                        }
                    }
                }
            });
        });

        // Process op-costs data (only for expenses and all views)
        if (
            (revenueType === "expenses" || revenueType === "net-profit") &&
            opCostsData &&
            opCostsData.length > 0
        ) {
            opCostsData.forEach((dataPoint: Record<string, number>) => {
                const tick = dataPoint.tick;
                if (typeof tick !== "number") return;

                if (!tickMap.has(tick)) {
                    tickMap.set(tick, { tick });
                }
                const result = tickMap.get(tick)!;

                Object.keys(dataPoint).forEach((key) => {
                    if (key === "tick") return;

                    const value = dataPoint[key] || 0;

                    if (revenueType === "expenses") {
                        // Op-costs are negative, display as positive for expenses view
                        result[key] = (result[key] ?? 0) + Math.abs(value);
                    } else if (revenueType === "net-profit") {
                        if (netProfitViewMode === "net") {
                            // For "net": aggregate op-costs into single "net-profit" value
                            result["net-profit"] =
                                (result["net-profit"] || 0) + value;
                        } else {
                            // For "breakdown": add op-costs to total expenses
                            result["total-expenses"] =
                                (result["total-expenses"] || 0) +
                                Math.abs(value);
                        }
                    }
                });
            });
        }

        // Convert map to sorted array
        let result = Array.from(tickMap.values()).sort(
            (a, b) => (a.tick ?? 0) - (b.tick ?? 0),
        );

        // For breakdown mode, transform gross-revenues and total-expenses into stacked series
        if (revenueType === "net-profit" && netProfitViewMode === "breakdown") {
            result = result.map((dataPoint) => {
                const grossRevenues = dataPoint["gross-revenues"] || 0;
                const totalExpenses = dataPoint["total-expenses"] || 0;

                return {
                    tick: dataPoint.tick ?? 0,
                    baseline: Math.min(grossRevenues, totalExpenses),
                    profit: Math.max(0, grossRevenues - totalExpenses),
                    loss: Math.max(0, totalExpenses - grossRevenues),
                };
            });
        }

        return result;
    }, [revenuesData, opCostsData, revenueType, netProfitViewMode]);

    return (
        <div className="p-4 md:p-8">
            <Card className="mb-6">
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2">Revenue Type</Label>
                            <Tabs
                                value={revenueType}
                                onValueChange={(value) =>
                                    setRevenueType(value as RevenueType)
                                }
                            >
                                <TabsList>
                                    {REVENUE_TYPE_OPTIONS.map((option) => (
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
                        {revenueType === "net-profit" ? (
                            <div>
                                <Label className="mb-2">View Mode</Label>
                                <Tabs
                                    value={netProfitViewMode}
                                    onValueChange={(value) =>
                                        setNetProfitViewMode(
                                            value as NetProfitViewMode,
                                        )
                                    }
                                >
                                    <TabsList>
                                        {NET_PROFIT_VIEW_MODE_OPTIONS.map(
                                            (option) => (
                                                <TabsTrigger
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </TabsTrigger>
                                            ),
                                        )}
                                    </TabsList>
                                </Tabs>
                            </div>
                        ) : (
                            <div>
                                <Label className="mb-2">View Mode</Label>
                                <Tabs
                                    value={viewMode}
                                    onValueChange={(value) =>
                                        setViewMode(
                                            value as "normal" | "percent",
                                        )
                                    }
                                >
                                    <TabsList>
                                        {VIEW_MODE_OPTIONS.map((option) => (
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
                        )}
                        <ResolutionPicker currentTick={currentTick} />
                    </div>
                </CardContent>
            </Card>

            <ChartCard
                icon={DollarSign}
                iconClassName="text-primary"
                title={
                    revenueType === "revenues"
                        ? "Revenues"
                        : revenueType === "expenses"
                          ? "Expenses"
                          : "Revenues & Expenses"
                }
                className="mb-6"
            >
                <RevenuesChart
                    chartData={filteredChartData}
                    isLoading={isChartLoading}
                    isError={isError}
                    hiddenFacilities={hiddenFacilities}
                    viewMode={viewMode}
                    revenueType={revenueType}
                    netProfitViewMode={netProfitViewMode}
                />

                <div className="mt-6">
                    <CashFlowOverviewTable
                        chartData={filteredChartData}
                        revenueType={revenueType}
                        hiddenFacilities={hiddenFacilities}
                        onToggleFacility={toggleFacility}
                    />
                </div>
            </ChartCard>
        </div>
    );
}

interface RevenuesChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenFacilities: Set<string>;
    viewMode: "normal" | "percent";
    revenueType: RevenueType;
    netProfitViewMode: NetProfitViewMode;
}

function RevenuesChart({
    chartData,
    isLoading,
    isError,
    hiddenFacilities,
    viewMode,
    revenueType,
    netProfitViewMode,
}: RevenuesChartProps) {
    const { data: gameEngineConfig } = useGameEngine();
    const { mode: timeMode } = useTimeMode();
    const getColor = useAssetColorGetter();

    // Custom color getter for breakdown mode
    const getBreakdownColor = useCallback((key: string) => {
        if (key === "baseline") return "hsl(var(--muted-foreground) / 0.5)";
        if (key === "profit") return "var(--success)";
        if (key === "loss") return "var(--destructive)";
        return "var(--foreground)";
    }, []);

    // Create filters - don't filter non-zero for net-profit view
    const filterDataKeys = useChartFilters(
        hiddenFacilities,
        revenueType !== "net-profit",
    );

    // Transform data for percent view if needed
    const transformedData: Array<Record<string, unknown>> = useMemo(() => {
        if (
            viewMode === "normal" ||
            revenueType === "net-profit" ||
            !chartData ||
            chartData.length === 0
        ) {
            return chartData;
        }

        // For percent view, calculate percentage based on total
        return chartData.map((dataPoint) => {
            const dp = dataPoint as Record<string, unknown>;
            const result: Record<string, unknown> = {
                tick: typeof dp.tick === "number" ? dp.tick : 0,
            };

            // Calculate total for this datapoint
            let total = 0;
            Object.keys(dp).forEach((key) => {
                if (key !== "tick") {
                    const val = typeof dp[key] === "number" ? dp[key] : 0;
                    total += Math.abs((val as number) || 0);
                }
            });

            Object.keys(dp).forEach((key) => {
                if (key === "tick") return;

                const val = typeof dp[key] === "number" ? dp[key] : 0;
                const value = (val as number) || 0;
                if (total > 0) {
                    // Preserve sign in percent view
                    result[key] = (value / total) * 100;
                } else {
                    result[key] = 0;
                }
            });

            return result;
        });
    }, [chartData, viewMode, revenueType]);

    const isShowingPercent =
        viewMode === "percent" && revenueType !== "net-profit";

    const formatValue = useCallback(
        (value: number) =>
            isShowingPercent ? (
                `${value.toFixed(1)}%`
            ) : (
                <CashFlow amountPerTick={value} />
            ),
        [isShowingPercent],
    );

    const chartConfig: TimeSeriesChartConfig | undefined = useMemo(() => {
        if (!gameEngineConfig) return undefined;

        const isBreakdownMode =
            revenueType === "net-profit" && netProfitViewMode === "breakdown";
        const isNetMode =
            revenueType === "net-profit" && netProfitViewMode === "net";

        // Determine chartType based on revenue type for proper key ordering
        const chartType =
            revenueType === "revenues"
                ? "revenues"
                : revenueType === "expenses"
                  ? "op-costs"
                  : undefined; // net-profit uses synthetic keys

        return {
            chartType,
            chartVariant: "area",
            stacked: true,
            showBrush: true,
            getColor: isBreakdownMode ? getBreakdownColor : getColor,
            filterDataKeys,
            formatValue,
            formatYAxis: (value: number) =>
                isShowingPercent
                    ? `${value}%`
                    : formatCashFlow(value, "h", gameEngineConfig, timeMode),
            // Use gradient fill for the "net-profit" series only in net mode
            gradientKeys: isNetMode ? ["net-profit"] : [],
        };
    }, [
        gameEngineConfig,
        revenueType,
        netProfitViewMode,
        getBreakdownColor,
        getColor,
        filterDataKeys,
        formatValue,
        isShowingPercent,
        timeMode,
    ]);

    if (!chartConfig) return <></>;

    return (
        <TimeSeriesChart
            data={transformedData}
            config={chartConfig}
            isLoading={isLoading}
            isError={isError}
        />
    );
}
