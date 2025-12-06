/** Leaderboards page - Overview of all players ranked by various metrics. */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { RequireSettledPlayer } from "@components/auth/ProtectedRoute";
import { GameLayout } from "@components/layout/GameLayout";
import { Modal, Card, Money } from "@components/ui";
import { useLeaderboards } from "@/hooks/useLeaderboards";
import { useHasCapability } from "@hooks/useCapabilities";
import { formatPower, formatEnergy, formatMass } from "@lib/format-utils";
import type { PlayerDetailStats } from "@/types/leaderboards";

export const Route = createFileRoute("/app/community/leaderboards")({
    component: LeaderboardsPage,
    staticData: {
        title: "Leaderboards",
    },
});

function LeaderboardsPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <LeaderboardsContent />
            </GameLayout>
        </RequireSettledPlayer>
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
    const [showInfoPopup, setShowInfoPopup] = useState(false);
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
            <div className="p-4 md:p-8 text-center text-red-600">
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
                    className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                    onClick={() => handleSort("username")}
                >
                    Username{getSortIndicator("username")}
                </th>
                <th
                    className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
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
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("general.average_revenues")
                            }
                        >
                            Revenues/h
                            {getSortIndicator("general.average_revenues")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("general.max_power_consumption")
                            }
                        >
                            Max Power
                            {getSortIndicator("general.max_power_consumption")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("general.total_technologies")
                            }
                        >
                            Technologies
                            {getSortIndicator("general.total_technologies")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
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
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
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
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
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
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
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
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
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
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("resources.extracted_resources")
                            }
                        >
                            Extracted
                            {getSortIndicator("resources.extracted_resources")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("resources.bought_resources")
                            }
                        >
                            Bought
                            {getSortIndicator("resources.bought_resources")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
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
                            className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() => handleSort("username")}
                        >
                            Username{getSortIndicator("username")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
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
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("technologies.mathematics")
                            }
                        >
                            <span
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                Mathematics
                                {getSortIndicator("technologies.mathematics")}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort(
                                    "technologies.mechanical_engineering",
                                )
                            }
                        >
                            <span
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                Mechanical Eng.
                                {getSortIndicator(
                                    "technologies.mechanical_engineering",
                                )}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("technologies.thermodynamics")
                            }
                        >
                            <span
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                Thermodynamics
                                {getSortIndicator(
                                    "technologies.thermodynamics",
                                )}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() => handleSort("technologies.physics")}
                        >
                            <span
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                Physics
                                {getSortIndicator("technologies.physics")}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("technologies.building_technology")
                            }
                        >
                            <span
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                Building Tech.
                                {getSortIndicator(
                                    "technologies.building_technology",
                                )}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("technologies.mineral_extraction")
                            }
                        >
                            <span
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                Mineral Extraction
                                {getSortIndicator(
                                    "technologies.mineral_extraction",
                                )}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("technologies.transport_technology")
                            }
                        >
                            <span
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                Transport Tech.
                                {getSortIndicator(
                                    "technologies.transport_technology",
                                )}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() => handleSort("technologies.materials")}
                        >
                            <span
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                Materials
                                {getSortIndicator("technologies.materials")}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("technologies.civil_engineering")
                            }
                        >
                            <span
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                Civil Eng.
                                {getSortIndicator(
                                    "technologies.civil_engineering",
                                )}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("technologies.aerodynamics")
                            }
                        >
                            <span
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                Aerodynamics
                                {getSortIndicator("technologies.aerodynamics")}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() => handleSort("technologies.chemistry")}
                        >
                            <span
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                Chemistry
                                {getSortIndicator("technologies.chemistry")}
                            </span>
                        </th>
                        <th
                            className="py-3 px-2 font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("technologies.nuclear_engineering")
                            }
                        >
                            <span
                                style={{
                                    writingMode: "sideways-lr",
                                    textOrientation: "mixed",
                                }}
                            >
                                Nuclear Eng.
                                {getSortIndicator(
                                    "technologies.nuclear_engineering",
                                )}
                            </span>
                        </th>
                    </>
                );
            case "functional_facilities":
                return (
                    <>
                        {commonHeaders}
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("functional_facilities.industry")
                            }
                        >
                            Industry
                            {getSortIndicator("functional_facilities.industry")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
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
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
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
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
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
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                            onClick={() =>
                                handleSort("emissions.net_emissions")
                            }
                        >
                            Emissions
                            {getSortIndicator("emissions.net_emissions")}
                        </th>
                        <th
                            className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
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
                            <Money amount={row.general.average_revenues} />
                            /h
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                            {formatPower(row.general.max_power_consumption)}
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
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Leaderboards
                </h1>
                <button
                    onClick={() => setShowInfoPopup(true)}
                    className="text-primary hover:opacity-80 transition-opacity"
                    aria-label="Show help"
                >
                    <HelpCircle className="w-8 h-8" />
                </button>
            </div>

            {/* Info modal */}
            <Modal
                isOpen={showInfoPopup}
                onClose={() => setShowInfoPopup(false)}
                title="Help : Leaderboards"
            >
                <div className="space-y-3">
                    <p>These are leaderboards of all players on the server.</p>
                    <p>
                        You can sort the table by clicking on the column
                        headers.
                    </p>
                    <p>
                        Use the category buttons below to view different sets of
                        statistics.
                    </p>
                </div>
            </Modal>

            {/* Category Filter */}
            <div className="mb-6 flex flex-wrap gap-2 justify-center">
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
                                    : "bg-tan-green/20 dark:bg-dark-bg-tertiary hover:bg-tan-green/40 dark:hover:bg-dark-bg-secondary"
                            }`}
                        >
                            {getCategoryLabel(category)}
                        </button>
                    );
                })}
            </div>

            {/* Leaderboards Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-tan-green dark:bg-dark-bg-tertiary">
                                {renderTableHeaders()}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRows.map((row) => (
                                <tr
                                    key={row.player_id}
                                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-tan-green/20 dark:hover:bg-dark-bg-tertiary/30 transition-colors"
                                >
                                    {renderTableRow(row)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
