/** Leaderboards page - Overview of all players ranked by various metrics. */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { GameLayout } from "@/components/layout/game-layout";
import { PageCard, CardContent, Money } from "@/components/ui";
import { useHasCapability } from "@/hooks/use-capabilities";
import { useLeaderboards } from "@/hooks/use-leaderboards";
import { formatPower, formatEnergy, formatMass } from "@/lib/format-utils";
import type { PlayerDetailStats } from "@/types/leaderboards";

function LeaderboardsHelp() {
    return (
        <div className="space-y-3">
            <p>These are leaderboards of all players on the server.</p>
            <p>You can sort the table by clicking on the column headers.</p>
            <p>
                Use the category buttons below to view different sets of
                statistics.
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/community/leaderboards")({
    component: LeaderboardsPage,
    staticData: {
        title: "Leaderboards",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => ({ unlocked: true }),
        },
        infoDialog: {
            contents: <LeaderboardsHelp />,
        },
    },
});

function LeaderboardsPage() {
    return (
        <GameLayout>
            <LeaderboardsContent />
        </GameLayout>
    );
}

type Category =
    | "general"
    | "power_and_energy"
    | "resources"
    | "technologies"
    | "functional_facilities"
    | "emissions";

type SortConfig = {
    key: string;
    direction: "asc" | "desc";
} | null;

function LeaderboardsContent() {
    const [selectedCategory, setSelectedCategory] =
        useState<Category>("general");
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    const { data: leaderboards, isLoading, error } = useLeaderboards();
    const hasGreenhouseGasEffect = useHasCapability(
        "has_greenhouse_gas_effect",
    );

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 text-center">
                <p className="text-lg">Loading leaderboards...</p>
            </div>
        );
    }

    if (error || !leaderboards?.rows) {
        return (
            <div className="p-4 md:p-8 text-center text-destructive">
                <p className="text-lg">Error loading leaderboards</p>
            </div>
        );
    }

    const getNestedValue = (
        obj: Record<string, unknown>,
        key: string,
    ): unknown => {
        if (key.includes(".")) {
            const [first, ...rest] = key.split(".");
            if (!first) return undefined;

            const nextObj = obj[first];
            if (typeof nextObj === "object" && nextObj !== null) {
                return getNestedValue(
                    nextObj as Record<string, unknown>,
                    rest.join("."),
                );
            }
            return nextObj;
        }
        return obj[key];
    };

    const sortRows = (rows: typeof leaderboards.rows) => {
        if (!sortConfig) return rows;

        return [...rows].sort((a, b) => {
            const aVal = getNestedValue(a, sortConfig.key);
            const bVal = getNestedValue(b, sortConfig.key);

            // Handle null values
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            const compareResult = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;

            return sortConfig.direction === "asc"
                ? compareResult
                : -compareResult;
        });
    };

    const handleSort = (key: string) => {
        setSortConfig((current) => {
            if (current?.key === key) {
                // Toggle direction or clear
                if (current.direction === "desc") {
                    return { key, direction: "asc" };
                }
                return null; // Clear sort
            }
            return { key, direction: "desc" };
        });
    };

    const getSortIndicator = (key: string) => {
        if (sortConfig?.key !== key) return null;
        return sortConfig.direction === "asc" ? " ▲" : " ▼";
    };

    const getSortIndicatorVertical = (key: string) => {
        if (sortConfig?.key !== key) return "";
        return sortConfig.direction === "asc" ? "▶︎ " : "◀︎";
    };

    const getCategoryLabel = (category: Category): string => {
        const labels: Record<Category, string> = {
            general: "General",
            power_and_energy: "Power & Energy",
            resources: "Resources",
            technologies: "Technologies",
            functional_facilities: "Functional Facilities",
            emissions: "Emissions",
        };
        return labels[category];
    };

    const sortedRows = sortRows(leaderboards.rows);

    const renderTableHeaders = () => {
        const commonHeaders = (
            <>
                <th
                    className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                    onClick={() => handleSort("username")}
                >
                    Username{getSortIndicator("username")}
                </th>
                <th
                    className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                    onClick={() => handleSort("general.network_name")}
                >
                    Network{getSortIndicator("general.network_name")}
                </th>
            </>
        );

        switch (selectedCategory) {
            case "general":
                return (
                    <>
                        {commonHeaders}
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("general.gross_earnings")
                            }
                        >
                            Gross Earnings
                            {getSortIndicator("general.gross_earnings")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("general.max_power_consumption")
                            }
                        >
                            Max Power
                            {getSortIndicator("general.max_power_consumption")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("general.total_projects")
                            }
                        >
                            Projects
                            {getSortIndicator("general.total_projects")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("general.total_technologies")
                            }
                        >
                            Technologies
                            {getSortIndicator("general.total_technologies")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("general.xp")}
                        >
                            XP{getSortIndicator("general.xp")}
                        </th>
                    </>
                );
            case "power_and_energy":
                return (
                    <>
                        {commonHeaders}
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort(
                                    "power_and_energy.max_power_consumption",
                                )
                            }
                        >
                            Max Power
                            {getSortIndicator(
                                "power_and_energy.max_power_consumption",
                            )}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("power_and_energy.max_energy_stored")
                            }
                        >
                            Max Storage
                            {getSortIndicator(
                                "power_and_energy.max_energy_stored",
                            )}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("power_and_energy.imported_energy")
                            }
                        >
                            Imported
                            {getSortIndicator(
                                "power_and_energy.imported_energy",
                            )}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("power_and_energy.exported_energy")
                            }
                        >
                            Exported
                            {getSortIndicator(
                                "power_and_energy.exported_energy",
                            )}
                        </th>
                    </>
                );
            case "resources":
                return (
                    <>
                        {commonHeaders}
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("resources.extracted_resources")
                            }
                        >
                            Extracted
                            {getSortIndicator("resources.extracted_resources")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("resources.bought_resources")
                            }
                        >
                            Bought
                            {getSortIndicator("resources.bought_resources")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("resources.sold_resources")
                            }
                        >
                            Sold{getSortIndicator("resources.sold_resources")}
                        </th>
                    </>
                );
            case "technologies":
                return (
                    <>
                        <th
                            className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("username")}
                        >
                            Username{getSortIndicator("username")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("technologies.total_technologies")
                            }
                        >
                            Total
                            {getSortIndicator(
                                "technologies.total_technologies",
                            )}
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("technologies.mathematics")
                            }
                        >
                            <span
                                className="text-nowrap"
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                {`${getSortIndicatorVertical("technologies.mathematics")}Mathematics`}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort(
                                    "technologies.mechanical_engineering",
                                )
                            }
                        >
                            <span
                                className="text-nowrap"
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                {`${getSortIndicatorVertical("technologies.mechanical_engineering")}Mechanical Eng.`}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("technologies.thermodynamics")
                            }
                        >
                            <span
                                className="text-nowrap"
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                {`${getSortIndicatorVertical("technologies.thermodynamics")}Thermodynamics`}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("technologies.physics")}
                        >
                            <span
                                className="text-nowrap"
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                {`${getSortIndicatorVertical("technologies.physics")}Physics`}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("technologies.building_technology")
                            }
                        >
                            <span
                                className="text-nowrap"
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                {`${getSortIndicatorVertical("technologies.building_technology")}Building Tech.`}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("technologies.mineral_extraction")
                            }
                        >
                            <span
                                className="text-nowrap"
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                {`${getSortIndicatorVertical("technologies.mineral_extraction")}Mineral Extraction`}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("technologies.transport_technology")
                            }
                        >
                            <span
                                className="text-nowrap"
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                {`${getSortIndicatorVertical("technologies.transport_technology")}Transport Tech.`}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("technologies.materials")}
                        >
                            <span
                                className="text-nowrap"
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                {`${getSortIndicatorVertical("technologies.materials")}Materials`}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("technologies.civil_engineering")
                            }
                        >
                            <span
                                className="text-nowrap"
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                {`${getSortIndicatorVertical("technologies.civil_engineering")}Civil Eng.`}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("technologies.aerodynamics")
                            }
                        >
                            <span
                                className="text-nowrap"
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                {`${getSortIndicatorVertical("technologies.aerodynamics")}Aerodynamics`}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("technologies.chemistry")}
                        >
                            <span
                                className="text-nowrap"
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                {`${getSortIndicatorVertical("technologies.chemistry")}Chemistry`}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("technologies.nuclear_engineering")
                            }
                        >
                            <span
                                className="text-nowrap"
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                {`${getSortIndicatorVertical("technologies.nuclear_engineering")}Nuclear Eng.`}
                            </span>
                        </th>
                    </>
                );
            case "functional_facilities":
                return (
                    <>
                        {commonHeaders}
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("functional_facilities.industry")
                            }
                        >
                            Industry
                            {getSortIndicator("functional_facilities.industry")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("functional_facilities.laboratory")
                            }
                        >
                            Laboratory
                            {getSortIndicator(
                                "functional_facilities.laboratory",
                            )}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("functional_facilities.warehouse")
                            }
                        >
                            Warehouse
                            {getSortIndicator(
                                "functional_facilities.warehouse",
                            )}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort(
                                    "functional_facilities.carbon_capture",
                                )
                            }
                        >
                            Carbon Capture
                            {getSortIndicator(
                                "functional_facilities.carbon_capture",
                            )}
                        </th>
                    </>
                );
            case "emissions":
                return (
                    <>
                        {commonHeaders}
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() =>
                                handleSort("emissions.net_emissions")
                            }
                        >
                            Emissions
                            {getSortIndicator("emissions.net_emissions")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                            onClick={() => handleSort("emissions.captured_co2")}
                        >
                            Captured CO₂
                            {getSortIndicator("emissions.captured_co2")}
                        </th>
                    </>
                );
        }
    };

    const renderTableRow = (row: PlayerDetailStats) => {
        const commonCells = (
            <>
                <td className="py-3 px-4">{row.username}</td>
                <td className="py-3 px-4">{row.general.network_name || "-"}</td>
            </>
        );

        switch (selectedCategory) {
            case "general":
                return (
                    <>
                        {commonCells}
                        <td className="py-3 px-4 text-right">
                            <Money amount={row.general.gross_earnings} />
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                            {formatPower(row.general.max_power_consumption)}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.general.total_projects}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.general.total_technologies}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {Math.round(row.general.xp)}
                        </td>
                    </>
                );
            case "power_and_energy":
                return (
                    <>
                        {commonCells}
                        <td className="py-3 px-4 text-right font-mono">
                            {formatPower(
                                row.power_and_energy.max_power_consumption,
                            )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                            {formatEnergy(
                                row.power_and_energy.max_energy_stored,
                            )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                            {formatEnergy(row.power_and_energy.imported_energy)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                            {formatEnergy(row.power_and_energy.exported_energy)}
                        </td>
                    </>
                );
            case "resources":
                return (
                    <>
                        {commonCells}
                        <td className="py-3 px-4 text-right font-mono">
                            {formatMass(row.resources.extracted_resources)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                            {formatMass(row.resources.bought_resources)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                            {formatMass(row.resources.sold_resources)}
                        </td>
                    </>
                );
            case "technologies":
                return (
                    <>
                        <td className="py-3 px-4">{row.username}</td>
                        <td className="py-3 px-4 text-right">
                            {row.technologies.total_technologies}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.technologies.mathematics}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.technologies.mechanical_engineering}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.technologies.thermodynamics}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.technologies.physics}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.technologies.building_technology}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.technologies.mineral_extraction}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.technologies.transport_technology}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.technologies.materials}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.technologies.civil_engineering}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.technologies.aerodynamics}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.technologies.chemistry}
                        </td>
                        <td className="py-3 px-4 text-right">
                            {row.technologies.nuclear_engineering}
                        </td>
                    </>
                );
            case "functional_facilities":
                return (
                    <>
                        {commonCells}
                        <td className="py-3 px-4 text-right">
                            lvl {row.functional_facilities.industry}
                        </td>
                        <td className="py-3 px-4 text-right">
                            lvl {row.functional_facilities.laboratory}
                        </td>
                        <td className="py-3 px-4 text-right">
                            lvl {row.functional_facilities.warehouse}
                        </td>
                        <td className="py-3 px-4 text-right">
                            lvl {row.functional_facilities.carbon_capture}
                        </td>
                    </>
                );
            case "emissions":
                return (
                    <>
                        {commonCells}
                        <td className="py-3 px-4 text-right font-mono">
                            {row.emissions
                                ? formatMass(row.emissions.net_emissions)
                                : "-"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                            {row.emissions
                                ? formatMass(row.emissions.captured_co2)
                                : "-"}
                        </td>
                    </>
                );
        }
    };

    return (
        <div className="py-4 md:p-8 flex flex-col gap-6">
            {/* Category Filter */}
            <div className="px-4 md:px-0 flex flex-wrap gap-2 justify-center">
                {(
                    [
                        "general",
                        "power_and_energy",
                        "resources",
                        "technologies",
                        "functional_facilities",
                        "emissions",
                    ] as const
                ).map((category) => {
                    // Only show emissions if capability is enabled
                    if (category === "emissions" && !hasGreenhouseGasEffect) {
                        return null;
                    }
                    return (
                        <button
                            key={category}
                            onClick={() => {
                                setSelectedCategory(category);
                                setSortConfig(null); // Clear sort when changing category
                            }}
                            className={`px-4 py-2 rounded font-medium transition-colors ${
                                selectedCategory === category
                                    ? "bg-primary text-white"
                                    : "bg-muted hover:bg-tan-green/40 dark:hover:bg-card"
                            }`}
                        >
                            {getCategoryLabel(category)}
                        </button>
                    );
                })}
            </div>

            {/* Leaderboards Table */}
            <PageCard>
                <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-secondary">
                                {renderTableHeaders()}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRows.map((row) => (
                                <tr
                                    key={row.player_id}
                                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-tan-green/20 dark:hover:bg-muted/30 transition-colors"
                                >
                                    {renderTableRow(row)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </PageCard>
        </div>
    );
}
