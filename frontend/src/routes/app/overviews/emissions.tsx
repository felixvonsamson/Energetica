/** Emissions overview page - CO2 emissions and climate data visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { Cloud, Thermometer, Globe, Leaf } from "lucide-react";
import { useState, useMemo, useCallback } from "react";

import {
    TimeSeriesChart,
    ResolutionPicker,
    EmissionsOverviewTable,
    type TimeSeriesChartConfig,
} from "@/components/charts";
import { GameLayout } from "@/components/layout/game-layout";
import { Card, CardContent } from "@/components/ui";
import { ChartCard } from "@/components/ui/chart-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTimeMode } from "@/contexts/time-mode-context";
import { useAssetColorGetter } from "@/hooks/useAssetColorGetter";
import { useChartFilters } from "@/hooks/useChartFilters";
import { useCurrentChartData } from "@/hooks/useCharts";
import { useGameTick } from "@/hooks/useGameTick";
import { useToggleSet } from "@/hooks/useToggleSet";

export const Route = createFileRoute("/app/overviews/emissions")({
    component: EmissionsOverviewPage,
    staticData: {
        title: "Emissions Overview",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) => cap.has_greenhouse_gas_effect,
        },
        infoModal: {
            contents: <EmissionsOverviewHelp />,
        },
    },
});

function EmissionsOverviewHelp() {
    return (
        <div className="space-y-3">
            <p>
                This page shows climate data and your contribution to greenhouse
                gas emissions.
            </p>
            <ul className="list-none space-y-1 ml-4">
                <li className="flex items-center gap-2">
                    <Globe className="w-4 h-4 shrink-0" />
                    <span>
                        <b>CO₂ in the Atmosphere:</b> Global CO₂ levels affected
                        by all players (concentration or total quantity)
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 shrink-0" />
                    <span>
                        <b>Global Average Temperature:</b> Temperature changes
                        caused by greenhouse gas emissions
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 shrink-0" />
                    <span>
                        <b>Your Emissions:</b> CO₂ emissions from your
                        facilities (view as rates or cumulative)
                    </span>
                </li>
                <li className="flex items-center gap-2">
                    <Leaf className="w-4 h-4 shrink-0" />
                    <span>
                        Reduce emissions by transitioning to renewable energy
                        sources
                    </span>
                </li>
            </ul>
            <p>
                Use the toggles to switch between absolute/relative views and
                different visualization modes for each chart.
            </p>
        </div>
    );
}

function EmissionsOverviewPage() {
    return (
        <GameLayout>
            <EmissionsOverviewContent />
        </GameLayout>
    );
}

const ABSOLUTE_RELATIVE_OPTIONS = [
    { value: "absolute", label: "Absolute" },
    { value: "relative", label: "Relative" },
] as const;

const CO2_UNIT_OPTIONS = [
    { value: "concentration", label: "Concentration" },
    { value: "quantity", label: "Quantity" },
] as const;

const EMISSIONS_VIEW_OPTIONS = [
    { value: "normal", label: "Normal" },
    { value: "percent", label: "Percent" },
] as const;

const EMISSIONS_CUMULATIVE_OPTIONS = [
    { value: "rates", label: "Rates" },
    { value: "cumulative", label: "Cumulative" },
] as const;

function EmissionsOverviewContent() {
    const { currentTick } = useGameTick();
    const [hiddenSources, toggleSource] = useToggleSet<string>();
    const [co2ViewMode, setCo2ViewMode] = useState<"absolute" | "relative">(
        "absolute",
    );
    const [co2UnitMode, setCo2UnitMode] = useState<
        "concentration" | "quantity"
    >("concentration");
    const [tempViewMode, setTempViewMode] = useState<"absolute" | "relative">(
        "absolute",
    );
    const [emissionsViewMode, setEmissionsViewMode] = useState<
        "normal" | "percent"
    >("normal");
    const [emissionsCumulativeMode, setEmissionsCumulativeMode] = useState<
        "rates" | "cumulative"
    >("rates");

    const { selectedResolution } = useTimeMode();

    // Fetch emissions chart data (player-specific)
    const {
        chartData: emissionsData,
        isLoading: isEmissionsLoading,
        isError: isEmissionsError,
    } = useCurrentChartData({
        chartType: "emissions",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
    });

    // Fetch climate data (global CO2)
    const {
        chartData: climateData,
        isLoading: isClimateLoading,
        isError: isClimateError,
    } = useCurrentChartData({
        chartType: "climate",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
    });

    // Fetch temperature data (global)
    const {
        chartData: temperatureData,
        isLoading: isTemperatureLoading,
        isError: isTemperatureError,
    } = useCurrentChartData({
        chartType: "temperature",
        currentTick,
        resolution: selectedResolution.resolution,
        maxDatapoints: selectedResolution.datapoints,
    });

    return (
        <div className="p-4 md:p-8 space-y-6">
            <Card>
                <CardContent>
                    <ResolutionPicker currentTick={currentTick} />
                </CardContent>
            </Card>

            {/* CO2 in Atmosphere */}
            <ChartCard
                icon={Globe}
                iconClassName="text-primary"
                title="CO₂ in the Atmosphere"
                subtitle="(affected by all players)"
            >
                <CO2Chart
                    chartData={climateData}
                    isLoading={isClimateLoading}
                    isError={isClimateError}
                    viewMode={co2ViewMode}
                    unitMode={co2UnitMode}
                />

                <div className="mt-4 flex flex-wrap gap-4">
                    <Tabs
                        value={co2ViewMode}
                        onValueChange={(value) =>
                            setCo2ViewMode(value as "absolute" | "relative")
                        }
                    >
                        <TabsList>
                            {ABSOLUTE_RELATIVE_OPTIONS.map((option) => (
                                <TabsTrigger
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <Tabs
                        value={co2UnitMode}
                        onValueChange={(value) =>
                            setCo2UnitMode(
                                value as "concentration" | "quantity",
                            )
                        }
                    >
                        <TabsList>
                            {CO2_UNIT_OPTIONS.map((option) => (
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
                {co2UnitMode === "concentration" && (
                    <div className="mt-2 text-sm text-muted-foreground">
                        ‰ = parts per thousand &emsp; ppm = parts per million
                        &emsp; ppb = parts per billion
                    </div>
                )}
            </ChartCard>

            {/* Global Temperature */}
            <ChartCard
                icon={Thermometer}
                iconClassName="text-primary"
                title="Global Average Temperature"
            >
                <TemperatureChart
                    chartData={temperatureData}
                    isLoading={isTemperatureLoading}
                    isError={isTemperatureError}
                    viewMode={tempViewMode}
                />

                <div className="mt-4">
                    <Tabs
                        value={tempViewMode}
                        onValueChange={(value) =>
                            setTempViewMode(value as "absolute" | "relative")
                        }
                    >
                        <TabsList>
                            {ABSOLUTE_RELATIVE_OPTIONS.map((option) => (
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
            </ChartCard>

            {/* Personal Emissions */}
            <ChartCard
                icon={Cloud}
                iconClassName="text-primary"
                title="Your Emissions"
            >
                <EmissionsChart
                    chartData={emissionsData}
                    isLoading={isEmissionsLoading}
                    isError={isEmissionsError}
                    hiddenSources={hiddenSources}
                    viewMode={emissionsViewMode}
                    cumulativeMode={emissionsCumulativeMode}
                />

                <div className="mt-4 flex flex-wrap gap-4">
                    <Tabs
                        value={emissionsViewMode}
                        onValueChange={(value) =>
                            setEmissionsViewMode(value as "normal" | "percent")
                        }
                    >
                        <TabsList>
                            {EMISSIONS_VIEW_OPTIONS.map((option) => (
                                <TabsTrigger
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <Tabs
                        value={emissionsCumulativeMode}
                        onValueChange={(value) =>
                            setEmissionsCumulativeMode(
                                value as "rates" | "cumulative",
                            )
                        }
                    >
                        <TabsList>
                            {EMISSIONS_CUMULATIVE_OPTIONS.map((option) => (
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

                <div className="mt-6">
                    <EmissionsOverviewTable
                        chartData={emissionsData}
                        resolution={selectedResolution.resolution}
                        hiddenSources={hiddenSources}
                        onToggleSource={toggleSource}
                    />
                </div>
            </ChartCard>
        </div>
    );
}

// CO2 Chart Component
interface CO2ChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    viewMode: "absolute" | "relative";
    unitMode: "concentration" | "quantity";
}

function CO2Chart({
    chartData,
    isLoading,
    isError,
    viewMode,
    unitMode,
}: CO2ChartProps) {
    // Transform data based on view mode and unit mode
    const transformedData = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];

        const REFERENCE_CO2 = 4e10; // kg - reference CO2 level
        const KG_TO_PPM = 3 / 4e5; // Conversion factor

        return chartData.map((dataPoint) => {
            const dp = dataPoint as Record<string, unknown>;
            const co2Value = typeof dp.CO2 === "number" ? dp.CO2 : 0;

            let value = co2Value;

            // Apply relative mode (subtract reference)
            if (viewMode === "relative") {
                value = value - REFERENCE_CO2;
            }

            // Apply concentration mode (convert to ppm)
            if (unitMode === "concentration") {
                value = value * KG_TO_PPM;
            }

            return {
                tick: typeof dp.tick === "number" ? dp.tick : 0,
                CO2: value,
                reference:
                    viewMode === "relative"
                        ? 0
                        : unitMode === "concentration"
                          ? REFERENCE_CO2 * KG_TO_PPM
                          : REFERENCE_CO2,
            };
        });
    }, [chartData, viewMode, unitMode]);

    // TODO: ensure these are from format utilities
    const formatValue = useCallback(
        (value: number): string => {
            if (unitMode === "concentration") {
                // Format as ppm
                const abs = Math.abs(value);
                if (abs >= 1000) {
                    return `${(value / 1000).toFixed(2)}‰`;
                } else if (abs >= 1) {
                    return `${value.toFixed(2)} ppm`;
                } else {
                    return `${(value * 1000).toFixed(2)} ppb`;
                }
            } else {
                // Format as mass
                const abs = Math.abs(value);
                if (abs >= 1e12) {
                    return `${(value / 1e12).toFixed(2)} Tt`;
                } else if (abs >= 1e9) {
                    return `${(value / 1e9).toFixed(2)} Gt`;
                } else if (abs >= 1e6) {
                    return `${(value / 1e6).toFixed(2)} Mt`;
                } else {
                    return `${(value / 1e3).toFixed(2)} t`;
                }
            }
        },
        [unitMode],
    );

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: "line",
            stacked: false,
            showBrush: true,
            getColor: (key: string) => (key === "CO2" ? "#ef4444" : "#9ca3af"),
            filterDataKeys: [],
            formatValue,
        }),
        [formatValue],
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

// Temperature Chart Component
interface TemperatureChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    viewMode: "absolute" | "relative";
}

function TemperatureChart({
    chartData,
    isLoading,
    isError,
    viewMode,
}: TemperatureChartProps) {
    // Transform data based on view mode
    const transformedData = useMemo(() => {
        if (!chartData || chartData.length === 0) return [];

        return chartData.map((dataPoint) => {
            const dp = dataPoint as Record<string, unknown>;
            const deviation =
                typeof dp.deviation === "number" ? dp.deviation : 0;
            const reference =
                typeof dp.reference === "number" ? dp.reference : 0;

            if (viewMode === "relative") {
                return {
                    tick: typeof dp.tick === "number" ? dp.tick : 0,
                    temperature: deviation,
                    reference: 0,
                };
            } else {
                return {
                    tick: typeof dp.tick === "number" ? dp.tick : 0,
                    temperature: deviation + reference,
                    reference: reference,
                };
            }
        });
    }, [chartData, viewMode]);

    const formatValue = (value: number): string => {
        return `${value.toFixed(2)}°C`;
    };

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: "line",
            stacked: false,
            height: 400,
            showBrush: true,
            getColor: (key: string) =>
                key === "temperature" ? "#f59e0b" : "#9ca3af",
            filterDataKeys: [],
            formatValue,
        }),
        [],
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

// Emissions Chart Component
interface EmissionsChartProps {
    chartData: Array<Record<string, unknown>>;
    isLoading: boolean;
    isError: boolean;
    hiddenSources: Set<string>;
    viewMode: "normal" | "percent";
    cumulativeMode: "rates" | "cumulative";
}

function EmissionsChart({
    chartData,
    isLoading,
    isError,
    hiddenSources,
    viewMode,
    cumulativeMode,
}: EmissionsChartProps) {
    const getColor = useAssetColorGetter();
    const filterDataKeys = useChartFilters(hiddenSources);

    // Transform data for cumulative and percent view
    const transformedData: Array<Record<string, unknown>> = useMemo(() => {
        if (!chartData || chartData.length === 0) {
            return chartData;
        }

        let processedData = chartData;

        // Apply cumulative transformation first if needed
        if (cumulativeMode === "cumulative") {
            // Calculate cumulative emissions by integrating rates over time
            const cumulativeData: Array<Record<string, unknown>> = [];
            const cumulative: Record<string, number> = {};

            // Process in reverse order (oldest to newest)
            for (let i = chartData.length - 1; i >= 0; i--) {
                const dp = chartData[i] as Record<string, unknown>;
                const result: Record<string, unknown> = {
                    tick: typeof dp.tick === "number" ? dp.tick : 0,
                };

                Object.keys(dp).forEach((key) => {
                    if (key === "tick") return;

                    const val = typeof dp[key] === "number" ? dp[key] : 0;
                    const rate = (val as number) || 0;

                    // Add the emission for this period (rate * resolution)
                    // Resolution is already accounted for in the rate from the API
                    cumulative[key] = (cumulative[key] ?? 0) + rate;

                    result[key] = cumulative[key];
                });

                cumulativeData.unshift(result);
            }

            processedData = cumulativeData;
        }

        // Apply percent transformation if needed
        if (viewMode === "percent") {
            return processedData.map((dataPoint) => {
                const dp = dataPoint as Record<string, unknown>;
                const result: Record<string, unknown> = {
                    tick: typeof dp.tick === "number" ? dp.tick : 0,
                };

                // Calculate total for this datapoint (absolute values)
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
                        // Calculate percentage, preserving sign
                        result[key] =
                            (Math.abs(value) / total) * 100 * Math.sign(value);
                    } else {
                        result[key] = 0;
                    }
                });

                return result;
            });
        }

        return processedData;
    }, [chartData, viewMode, cumulativeMode]);

    const formatValue = useCallback(
        (value: number): string => {
            if (viewMode === "percent") {
                return `${value.toFixed(1)}%`;
            }

            // Format as mass (kg)
            const abs = Math.abs(value);
            if (abs >= 1e12) {
                return `${(value / 1e12).toFixed(2)} Tt`;
            } else if (abs >= 1e9) {
                return `${(value / 1e9).toFixed(2)} Gt`;
            } else if (abs >= 1e6) {
                return `${(value / 1e6).toFixed(2)} Mt`;
            } else if (abs >= 1e3) {
                return `${(value / 1e3).toFixed(2)} t`;
            } else {
                return `${value.toFixed(2)} kg`;
            }
        },
        [viewMode],
    );

    const chartConfig: TimeSeriesChartConfig = useMemo(
        () => ({
            chartVariant: "area",
            stacked: true,
            height: 400,
            showBrush: true,
            getColor,
            filterDataKeys,
            formatValue,
        }),
        [getColor, filterDataKeys, formatValue],
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
