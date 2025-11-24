/**
 * Scoreboard page - Overview of all players ranked by various metrics.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout/GameLayout";
import { Modal, Card, Money } from "@/components/ui";
import { useScoreboard } from "@/hooks/useScoreboard";
import { useHasCapability } from "@/hooks/useCapabilities";
import { formatPower } from "@/lib/format-utils";

export const Route = createFileRoute("/app/community/scoreboard")({
    component: ScoreboardPage,
    staticData: {
        title: "Scoreboard",
    },
});

function ScoreboardPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <ScoreboardContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

type SortConfig = {
    key:
        | "username"
        | "network_name"
        | "average_hourly_revenues"
        | "max_power_consumption"
        | "total_technology_levels"
        | "xp"
        | "co2_emissions";
    direction: "asc" | "desc";
} | null;

function ScoreboardContent() {
    const [showInfoPopup, setShowInfoPopup] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    const { data: scoreboard, isLoading, error } = useScoreboard();
    const hasGreenhouseGasEffect = useHasCapability(
        "has_greenhouse_gas_effect",
    );

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 text-center">
                <p className="text-lg">Loading scoreboard...</p>
            </div>
        );
    }

    if (error || !scoreboard?.rows) {
        return (
            <div className="p-4 md:p-8 text-center text-red-600">
                <p className="text-lg">Error loading scoreboard</p>
            </div>
        );
    }

    const sortRows = (rows: typeof scoreboard.rows) => {
        if (!sortConfig) return rows;

        return [...rows].sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

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

    const handleSort = (
        key:
            | "username"
            | "network_name"
            | "average_hourly_revenues"
            | "max_power_consumption"
            | "total_technology_levels"
            | "xp"
            | "co2_emissions",
    ) => {
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

    const getSortIndicator = (
        key:
            | "username"
            | "network_name"
            | "average_hourly_revenues"
            | "max_power_consumption"
            | "total_technology_levels"
            | "xp"
            | "co2_emissions",
    ) => {
        if (sortConfig?.key !== key) return null;
        return sortConfig.direction === "asc" ? " ▲" : " ▼";
    };

    const sortedRows = sortRows(scoreboard.rows);

    return (
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Scoreboard
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
                title="Help : Scoreboard"
            >
                <div className="space-y-3">
                    <p>This is a scoreboard of all players on the server.</p>
                    <p>
                        You can sort the table by clicking on the column
                        headers.
                    </p>
                </div>
            </Modal>

            {/* Scoreboard Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-tan-green dark:bg-dark-bg-tertiary">
                                <th
                                    className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                                    onClick={() => handleSort("username")}
                                >
                                    Username{getSortIndicator("username")}
                                </th>
                                <th
                                    className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                                    onClick={() => handleSort("network_name")}
                                >
                                    Network{getSortIndicator("network_name")}
                                </th>
                                <th
                                    className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                                    onClick={() =>
                                        handleSort("average_hourly_revenues")
                                    }
                                >
                                    Revenues
                                    {getSortIndicator(
                                        "average_hourly_revenues",
                                    )}
                                </th>
                                <th
                                    className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                                    onClick={() =>
                                        handleSort("max_power_consumption")
                                    }
                                >
                                    Max power
                                    {getSortIndicator("max_power_consumption")}
                                </th>
                                <th
                                    className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                                    onClick={() =>
                                        handleSort("total_technology_levels")
                                    }
                                >
                                    Technology
                                    {getSortIndicator(
                                        "total_technology_levels",
                                    )}
                                </th>
                                <th
                                    className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                                    onClick={() => handleSort("xp")}
                                >
                                    xp{getSortIndicator("xp")}
                                </th>
                                {hasGreenhouseGasEffect && (
                                    <th
                                        className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-dark-bg-secondary transition-colors"
                                        onClick={() =>
                                            handleSort("co2_emissions")
                                        }
                                    >
                                        Emissions
                                        {getSortIndicator("co2_emissions")}
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRows.map((row, idx) => (
                                <tr
                                    key={row.player_id}
                                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-tan-green/20 dark:hover:bg-dark-bg-tertiary/30 transition-colors"
                                >
                                    <td className="py-3 px-4">
                                        {row.username}
                                    </td>
                                    <td className="py-3 px-4">
                                        {row.network_name || "-"}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <Money
                                            amount={row.average_hourly_revenues}
                                        />
                                        /h
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono">
                                        {formatPower(row.max_power_consumption)}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        {row.total_technology_levels}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        {Math.round(row.xp)}
                                    </td>
                                    {hasGreenhouseGasEffect && (
                                        <td className="py-3 px-4 text-right font-mono">
                                            {row.co2_emissions !== null
                                                ? `${row.co2_emissions.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")} kg`
                                                : "-"}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
