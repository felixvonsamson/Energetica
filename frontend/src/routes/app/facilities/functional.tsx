import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { RequireSettledPlayer } from "@components/auth/ProtectedRoute";
import { GameLayout } from "@components/layout/GameLayout";
import { Modal, Money } from "@components/ui";
import { useFunctionalFacilitiesCatalog } from "@hooks/useProjects";
import type { ApiSchema } from "@app-types/api-helpers";
import { FacilityCard } from "@components/facilities";
import {
    formatPower,
    formatMass,
    formatUpgradePower,
    formatUpgradeMass,
    formatUpgradeMassRate,
} from "@lib/format-utils";

export const Route = createFileRoute("/app/facilities/functional")({
    component: FunctionalFacilitiesPage,
    staticData: {
        title: "Functional Facilities",
    },
});

function FunctionalFacilitiesPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <FunctionalFacilitiesContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

type FunctionalFacility = ApiSchema<"FunctionalFacilityCatalogOut">;

function FunctionalFacilitiesContent() {
    const [showInfoPopup, setShowInfoPopup] = useState(false);

    const {
        data: catalogData,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
    } = useFunctionalFacilitiesCatalog();

    const facilities = catalogData?.functional_facilities ?? [];

    return (
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Functional Facilities
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
                title="Help : Functional Facilities"
            >
                <div className="space-y-3">
                    <p>
                        On this page you will find facilities with unique
                        abilities and their specific information.
                    </p>
                    <p>
                        For more information about Functional Facilities, refer
                        to{" "}
                        <a
                            href="/wiki/functional_facilities"
                            className="underline hover:opacity-80 text-white dark:text-dark-text-primary"
                        >
                            this section in the wiki
                        </a>
                        .
                    </p>
                </div>
            </Modal>

            {/* TODO: Under construction facilities will show here */}
            <div id="under_construction" className="mb-6"></div>

            {/* Loading state */}
            {isCatalogLoading && (
                <div className="text-center py-8 text-gray-500">
                    Loading facilities...
                </div>
            )}

            {/* Error state */}
            {isCatalogError && (
                <div className="text-center py-8 text-alert-red">
                    Failed to load functional facilities. Please try again.
                </div>
            )}

            {/* Facilities list */}
            {!isCatalogLoading && facilities.length > 0 && (
                <div className="space-y-4">
                    {facilities.map((facility) => (
                        <FacilityCard
                            key={facility.name}
                            facility={facility}
                            facilityType="functional"
                            renderDescription={(facility) => {
                                // Custom descriptions for laboratory and warehouse
                                if (facility.name === "laboratory") {
                                    return (
                                        <>
                                            The laboratory is needed to research{" "}
                                            <strong>
                                                <a
                                                    className="text-blue-600 dark:text-blue-400"
                                                    href="/technology"
                                                >
                                                    Technologies
                                                </a>
                                            </strong>
                                            .<br />
                                            +1 lab worker every 3rd level.
                                        </>
                                    );
                                } else if (facility.name === "warehouse") {
                                    return (
                                        <>
                                            The warehouse stores physical{" "}
                                            <strong>
                                                <a
                                                    className="text-blue-600 dark:text-blue-400"
                                                    href="/facilities/extraction"
                                                >
                                                    resources
                                                </a>
                                            </strong>
                                            .
                                        </>
                                    );
                                } else {
                                    return (
                                        <div
                                            dangerouslySetInnerHTML={{
                                                __html: facility.description,
                                            }}
                                        />
                                    );
                                }
                            }}
                            renderStatsTable={(facility) => (
                                <FunctionalFacilityStatsTable
                                    facility={facility}
                                />
                            )}
                            extraHeaderContent={(facility) => (
                                <span className="text-lg">
                                    lvl.{" "}
                                    <em className="text-xl">
                                        {facility.level}
                                    </em>
                                </span>
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

interface FunctionalFacilityStatsTableProps {
    facility: FunctionalFacility;
}

function FunctionalFacilityStatsTable({
    facility,
}: FunctionalFacilityStatsTableProps) {
    const isWarehouse = facility.name === "warehouse";

    return (
        <div className="overflow-x-auto">
            <table
                className={`min-w-full text-sm border-collapse ${
                    ["industry", "carbon_capture"].includes(facility.name)
                        ? "max-w-md"
                        : ""
                }`}
            >
                <thead>
                    <tr className="bg-tan-green/20 dark:bg-dark-bg-tertiary/30">
                        <th className="py-2 px-4 text-left font-semibold">
                            Effects:
                        </th>
                        <th className="py-2 px-4 text-center font-semibold">
                            lvl {facility.level - 1} → lvl {facility.level}
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-tan-green/20 dark:bg-dark-bg-tertiary/30">
                    {/* Average Consumption (Industry) */}
                    {facility.average_consumption && (
                        <tr className="border-b border-pine/10 dark:border-dark-border/30">
                            <td className="py-2 px-4 font-semibold">
                                Average consumption
                            </td>
                            <td className="py-2 px-4 text-center font-mono">
                                {formatUpgradePower(
                                    facility.average_consumption.current,
                                    facility.average_consumption.upgraded ?? 0,
                                )}
                            </td>
                        </tr>
                    )}

                    {/* Revenue Generation (Industry) */}
                    {facility.revenue_generation && (
                        <tr className="border-b border-pine/10 dark:border-dark-border/30">
                            <td className="py-2 px-4 font-semibold">
                                Revenue generation
                            </td>
                            <td className="py-2 px-4 text-center">
                                {/* TODO: Create formatUpgradeMoney when Money component supports upgrade display */}
                                <Money
                                    amount={
                                        facility.revenue_generation.upgraded ??
                                        0
                                    }
                                />
                                /h
                            </td>
                        </tr>
                    )}

                    {/* Research Speed Bonus (Laboratory) */}
                    {facility.research_speed_bonus !== undefined &&
                        facility.research_speed_bonus !== null && (
                            <tr className="border-b border-pine/10 dark:border-dark-border/30">
                                <td className="py-2 px-4 font-semibold">
                                    Research speed
                                </td>
                                <td className="py-2 px-4 text-center font-mono">
                                    +{Math.round(facility.research_speed_bonus)}
                                    %
                                </td>
                            </tr>
                        )}

                    {/* Lab Workers (Laboratory) */}
                    {facility.lab_workers &&
                        (facility.lab_workers.current !== null ||
                            facility.lab_workers.upgraded !== null) && (
                            <tr className="border-b border-pine/10 dark:border-dark-border/30">
                                <td className="py-2 px-4 font-semibold">
                                    Lab workers
                                </td>
                                <td className="py-2 px-4 text-center font-mono">
                                    {facility.lab_workers.current ?? 0} →{" "}
                                    {facility.lab_workers.upgraded ?? 0}
                                </td>
                            </tr>
                        )}

                    {/* Warehouse Capacities */}
                    {facility.warehouse_capacities && (
                        <>
                            <tr className="border-b border-pine/10 dark:border-dark-border/30">
                                <td className="py-2 px-4 font-semibold">
                                    Coal capacity
                                </td>
                                <td className="py-2 px-4 text-center font-mono">
                                    {formatUpgradeMass(
                                        facility.warehouse_capacities.coal
                                            ?.current ?? null,
                                        facility.warehouse_capacities.coal
                                            ?.upgraded ?? 0,
                                    )}
                                </td>
                            </tr>
                            <tr className="border-b border-pine/10 dark:border-dark-border/30">
                                <td className="py-2 px-4 font-semibold">
                                    Gas capacity
                                </td>
                                <td className="py-2 px-4 text-center font-mono">
                                    {formatUpgradeMass(
                                        facility.warehouse_capacities.gas
                                            ?.current ?? null,
                                        facility.warehouse_capacities.gas
                                            ?.upgraded ?? 0,
                                    )}
                                </td>
                            </tr>
                            <tr className="border-b border-pine/10 dark:border-dark-border/30">
                                <td className="py-2 px-4 font-semibold">
                                    Uranium cap.
                                </td>
                                <td className="py-2 px-4 text-center font-mono">
                                    {formatUpgradeMass(
                                        facility.warehouse_capacities.uranium
                                            ?.current ?? null,
                                        facility.warehouse_capacities.uranium
                                            ?.upgraded ?? 0,
                                    )}
                                </td>
                            </tr>
                        </>
                    )}

                    {/* Power Consumption (Carbon Capture) */}
                    {facility.power_consumption && (
                        <tr className="border-b border-pine/10 dark:border-dark-border/30">
                            <td className="py-2 px-4 font-semibold">
                                Power consumption
                            </td>
                            <td className="py-2 px-4 text-center font-mono">
                                {formatUpgradePower(
                                    facility.power_consumption.current,
                                    facility.power_consumption.upgraded ?? 0,
                                )}
                            </td>
                        </tr>
                    )}

                    {/* CO2 Absorption (Carbon Capture) */}
                    {facility.co2_absorption && (
                        <tr>
                            <td className="py-2 px-4 font-semibold">
                                CO₂ absorbed
                            </td>
                            <td className="py-2 px-4 text-center font-mono">
                                {formatUpgradeMassRate(
                                    facility.co2_absorption.current,
                                    facility.co2_absorption.upgraded ?? 0,
                                )}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
