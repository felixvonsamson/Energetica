/** Revenues overview page - Revenue and expenses visualization. */

import { createFileRoute } from "@tanstack/react-router";
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    PieChart,
    Funnel,
} from "lucide-react";
import { useState, useMemo } from "react";

import {
    NetProfitViewMode,
    CashFlowChart,
    CashFlowType,
    CashFlowOverviewTable,
} from "@/components/charts/cash-flow-chart";
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

export const Route = createFileRoute("/app/overviews/cash-flow")({
    component: RevenuesOverviewPage,
    staticData: {
        title: "Cash Flow Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => ({ unlocked: true }),
        },
        infoDialog: {
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
    const [revenueType, setRevenueType] = useState<CashFlowType>("revenues");
    const [hiddenFacilities, toggleFacility] = useToggleSet<string>();
    const { selectedResolution } = useResolution();

    // Fetch both revenue and op-costs chart data
    const {
        chartData: revenuesData,
        isLoading: isRevenuesLoading,
        isError: isRevenuesError,
    } = useChartData({
        config: {
            chartType: "revenues",
            resolution: selectedResolution.resolution,
        },
        maxDatapoints: selectedResolution.datapoints,
    });

    const {
        chartData: opCostsData,
        isLoading: isOpCostsLoading,
        isError: isOpCostsError,
    } = useChartData({
        config: {
            chartType: "op-costs",
            resolution: selectedResolution.resolution,
        },
        maxDatapoints: selectedResolution.datapoints,
    });

    const isChartLoading = isRevenuesLoading || isOpCostsLoading;
    const isError = isRevenuesError || isOpCostsError;

    // Merge and filter data based on revenue type
    const filteredChartData = useMemo(() => {
        if (revenuesData.length === 0) {
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

                switch (revenueType) {
                    case "revenues":
                        // Only include positive values from revenues
                        result[key] = value > 0 ? value : 0;
                        break;
                    case "expenses":
                        // Only include negative values from revenues, displayed as positive
                        result[key] = value < 0 ? Math.abs(value) : 0;
                        break;
                    case "net-profit":
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
                        break;
                    default:
                        throw revenueType satisfies never;
                }
            });
        });

        // Process op-costs data (only for expenses and all views)
        if (
            (revenueType === "expenses" || revenueType === "net-profit") &&
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

                    switch (revenueType) {
                        case "expenses":
                            // Op-costs are negative, display as positive for expenses view
                            result[key] = (result[key] ?? 0) + Math.abs(value);
                            break;
                        case "net-profit":
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
                            break;
                        default:
                            throw revenueType satisfies never;
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
        <div className="py-4 md:p-8 space-y-6">
            <PageCard>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-2">Revenue Type</Label>
                            <SegmentedPicker
                                value={revenueType}
                                onValueChange={(value) =>
                                    setRevenueType(value as CashFlowType)
                                }
                            >
                                {REVENUE_TYPE_OPTIONS.map((option) => (
                                    <SegmentedPickerOption
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SegmentedPickerOption>
                                ))}
                            </SegmentedPicker>
                        </div>
                        {revenueType === "net-profit" ? (
                            <div>
                                <Label className="mb-2">View Mode</Label>
                                <SegmentedPicker
                                    value={netProfitViewMode}
                                    onValueChange={(value) =>
                                        setNetProfitViewMode(
                                            value as NetProfitViewMode,
                                        )
                                    }
                                >
                                    {NET_PROFIT_VIEW_MODE_OPTIONS.map(
                                        (option) => (
                                            <SegmentedPickerOption
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SegmentedPickerOption>
                                        ),
                                    )}
                                </SegmentedPicker>
                            </div>
                        ) : (
                            <div>
                                <Label className="mb-2">View Mode</Label>
                                <SegmentedPicker
                                    value={viewMode}
                                    onValueChange={(value) =>
                                        setViewMode(
                                            value as "normal" | "percent",
                                        )
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
                        )}
                        <ResolutionPicker currentTick={currentTick} />
                    </div>
                </CardContent>
            </PageCard>

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
            >
                <CashFlowChart
                    chartData={filteredChartData}
                    isLoading={isChartLoading}
                    isError={isError}
                    hiddenFacilities={hiddenFacilities}
                    viewMode={viewMode}
                    revenueType={revenueType}
                    netProfitViewMode={netProfitViewMode}
                />

                <CashFlowOverviewTable
                    chartData={filteredChartData}
                    revenueType={revenueType}
                    hiddenFacilities={hiddenFacilities}
                    onToggleFacility={toggleFacility}
                />
            </ChartCard>
        </div>
    );
}
