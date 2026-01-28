/** Emissions overview page - CO2 emissions and climate data visualization. */

import { createFileRoute } from "@tanstack/react-router";
import { Cloud, Thermometer, Globe, Leaf } from "lucide-react";
import { useState } from "react";

import { CO2Chart } from "@/components/charts/co2-chart";
import {
    EmissionsChart,
    EmissionsOverviewTable,
} from "@/components/charts/emissions-chart";
import { TemperatureChart } from "@/components/charts/temperature-chart";
import { GameLayout } from "@/components/layout/game-layout";
import { Card, CardContent } from "@/components/ui";
import { ChartCard } from "@/components/ui/chart-card";
import { ResolutionPicker } from "@/components/ui/resolution-picker";
import {
    SegmentedPicker,
    SegmentedPickerOption,
} from "@/components/ui/segmented-picker";
import { useTimeMode } from "@/contexts/time-mode-context";
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
        config: {
            chartType: "emissions",
            resolution: selectedResolution.resolution,
        },
        currentTick,
        maxDatapoints: selectedResolution.datapoints,
    });

    // Fetch climate data (global CO2)
    const {
        chartData: climateData,
        isLoading: isClimateLoading,
        isError: isClimateError,
    } = useCurrentChartData({
        config: {
            chartType: "climate",
            resolution: selectedResolution.resolution,
        },
        currentTick,
        maxDatapoints: selectedResolution.datapoints,
    });

    // Fetch temperature data (global)
    const {
        chartData: temperatureData,
        isLoading: isTemperatureLoading,
        isError: isTemperatureError,
    } = useCurrentChartData({
        config: {
            chartType: "temperature",
            resolution: selectedResolution.resolution,
        },
        currentTick,
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
                    <SegmentedPicker
                        value={co2ViewMode}
                        onValueChange={(value) =>
                            setCo2ViewMode(value as "absolute" | "relative")
                        }
                    >
                        {ABSOLUTE_RELATIVE_OPTIONS.map((option) => (
                            <SegmentedPickerOption
                                key={option.value}
                                value={option.value}
                            >
                                {option.label}
                            </SegmentedPickerOption>
                        ))}
                    </SegmentedPicker>
                    <SegmentedPicker
                        value={co2UnitMode}
                        onValueChange={(value) =>
                            setCo2UnitMode(
                                value as "concentration" | "quantity",
                            )
                        }
                    >
                        {CO2_UNIT_OPTIONS.map((option) => (
                            <SegmentedPickerOption
                                key={option.value}
                                value={option.value}
                            >
                                {option.label}
                            </SegmentedPickerOption>
                        ))}
                    </SegmentedPicker>
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
                    <SegmentedPicker
                        value={tempViewMode}
                        onValueChange={(value) =>
                            setTempViewMode(value as "absolute" | "relative")
                        }
                    >
                        {ABSOLUTE_RELATIVE_OPTIONS.map((option) => (
                            <SegmentedPickerOption
                                key={option.value}
                                value={option.value}
                            >
                                {option.label}
                            </SegmentedPickerOption>
                        ))}
                    </SegmentedPicker>
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
                    <SegmentedPicker
                        value={emissionsViewMode}
                        onValueChange={(value) =>
                            setEmissionsViewMode(value as "normal" | "percent")
                        }
                    >
                        {EMISSIONS_VIEW_OPTIONS.map((option) => (
                            <SegmentedPickerOption
                                key={option.value}
                                value={option.value}
                            >
                                {option.label}
                            </SegmentedPickerOption>
                        ))}
                    </SegmentedPicker>
                    <SegmentedPicker
                        value={emissionsCumulativeMode}
                        onValueChange={(value) =>
                            setEmissionsCumulativeMode(
                                value as "rates" | "cumulative",
                            )
                        }
                    >
                        {EMISSIONS_CUMULATIVE_OPTIONS.map((option) => (
                            <SegmentedPickerOption
                                key={option.value}
                                value={option.value}
                            >
                                {option.label}
                            </SegmentedPickerOption>
                        ))}
                    </SegmentedPicker>
                </div>

                <EmissionsOverviewTable
                    chartData={emissionsData}
                    resolution={selectedResolution.resolution}
                    hiddenSources={hiddenSources}
                    onToggleSource={toggleSource}
                />
            </ChartCard>
        </div>
    );
}
