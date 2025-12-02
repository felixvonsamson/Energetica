import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { RequireSettledPlayer } from "@components/auth/ProtectedRoute";
import { GameLayout } from "@components/layout/GameLayout";
import { Modal, Money } from "@components/ui";
import { usePowerFacilitiesCatalog } from "@hooks/useProjects";
import { usePlayerResources } from "@hooks/usePlayerResources";
import type { ApiSchema } from "@app-types/api-helpers";
import { FacilityCard, ResourceStockIndicators } from "@components/facilities";
import { formatPower, formatMass } from "@lib/format-utils";

export const Route = createFileRoute("/app/facilities/power")({
    component: PowerFacilitiesPage,
    staticData: {
        title: "Power Facilities",
    },
});

function PowerFacilitiesPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <PowerFacilitiesContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

type PowerFacility = ApiSchema<"PowerFacilityCatalogOut">;

function PowerFacilitiesContent() {
    const [showInfoPopup, setShowInfoPopup] = useState(false);

    const {
        data: catalogData,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
    } = usePowerFacilitiesCatalog();

    const { data: resourcesData, isLoading: isResourcesLoading } =
        usePlayerResources();

    const facilities = catalogData?.power_facilities ?? [];

    // Extract stock values from resource data
    const playerResources = resourcesData
        ? {
              coal: resourcesData.coal.stock,
              gas: resourcesData.gas.stock,
              uranium: resourcesData.uranium.stock,
          }
        : { coal: 0, gas: 0, uranium: 0 };

    return (
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Power Facilities
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
                title="Help : Power Facilities"
            >
                <div className="space-y-3">
                    <p>
                        On this page you will find all the facilities that
                        generate electricity and their respective information.
                    </p>
                    <p>
                        When clicking on a specific tile, it will extend the
                        tile and show you more information about the facility as
                        well as a button to start the construction of the
                        facility.
                    </p>
                    <p>
                        Some facilities might be locked and require certain
                        technologies to be unlocked. To research technologies,
                        you need a laboratory.
                    </p>
                    <p>
                        For more information about power facilities, refer to{" "}
                        <a
                            href="/wiki/power_facilities"
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
            {(isCatalogLoading || isResourcesLoading) && (
                <div className="text-center py-8 text-gray-500">
                    Loading facilities...
                </div>
            )}

            {/* Error state */}
            {isCatalogError && (
                <div className="text-center py-8 text-alert-red">
                    Failed to load power facilities. Please try again.
                </div>
            )}

            {/* Facilities list */}
            {!isCatalogLoading &&
                !isResourcesLoading &&
                facilities.length > 0 && (
                    <div className="space-y-4">
                        {facilities.map((facility) => (
                            <FacilityCard
                                key={facility.name}
                                facility={facility}
                                facilityType="power"
                                renderDescription={(facility) => (
                                    <div>
                                        <div
                                            className="mb-2"
                                            dangerouslySetInnerHTML={{
                                                __html: facility.description,
                                            }}
                                        />
                                        <ResourceStockIndicators
                                            facilityName={facility.name}
                                            windPotential={
                                                facility.wind_potential
                                            }
                                            solarPotential={
                                                facility.solar_potential
                                            }
                                            hydroPotential={
                                                facility.hydro_potential
                                            }
                                            highHydroCost={
                                                facility.high_hydro_cost
                                            }
                                            lowWindSpeed={
                                                facility.low_wind_speed
                                            }
                                            playerResources={playerResources}
                                        />
                                    </div>
                                )}
                                renderStatsTable={(facility) => (
                                    <PowerFacilityStatsTable
                                        facility={facility}
                                    />
                                )}
                                imageExtensionMap={{
                                    combined_cycle: "png",
                                    nuclear_reactor_gen4: "png",
                                    steam_engine: "png",
                                }}
                            />
                        ))}
                    </div>
                )}
        </div>
    );
}

interface PowerFacilityStatsTableProps {
    facility: PowerFacility;
}

function PowerFacilityStatsTable({ facility }: PowerFacilityStatsTableProps) {
    // TODO: Format days properly when we have game constants
    const formatDays = (ticks: number) => {
        return Math.round(ticks / 100); // Placeholder
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
                <tbody className="bg-tan-green/20 dark:bg-dark-bg-tertiary/30">
                    {/* Max Generation */}
                    <tr className="border-b border-pine/10 dark:border-dark-border/30">
                        <td className="py-2 px-4 font-semibold">
                            Max generation
                        </td>
                        <td className="py-2 px-4 text-center font-mono">
                            {formatPower(facility.power_generation)}
                        </td>
                    </tr>

                    {/* Ramping Speed */}
                    {facility.ramping_speed !== undefined &&
                        facility.ramping_speed !== null && (
                            <tr className="border-b border-pine/10 dark:border-dark-border/30">
                                <td className="py-2 px-4 font-semibold">
                                    Ramping speed
                                </td>
                                <td className="py-2 px-4 text-center font-mono">
                                    {formatPower(facility.ramping_speed)}/min
                                </td>
                            </tr>
                        )}

                    {/* Operation Cost */}
                    <tr className="border-b border-pine/10 dark:border-dark-border/30">
                        <td className="py-2 px-4 font-semibold">
                            Operation cost
                        </td>
                        <td className="py-2 px-4 text-center">
                            <Money amount={facility.operating_costs} />
                            /h
                        </td>
                    </tr>

                    {/* Capacity Factor */}
                    {facility.capacity_factor && (
                        <tr className="border-b border-pine/10 dark:border-dark-border/30">
                            <td className="py-2 px-4 font-semibold">
                                Capacity factor
                            </td>
                            <td className="py-2 px-4 text-center font-mono">
                                {facility.capacity_factor}
                            </td>
                        </tr>
                    )}

                    {/* Resource Consumption */}
                    {Object.entries(facility.consumed_resources).map(
                        ([resource, amount]) => {
                            if (!["coal", "gas", "uranium"].includes(resource))
                                return null;

                            let displayName = resource;
                            let displayValue = "";

                            if (resource === "uranium") {
                                displayName = "Uran. consumption";
                                if (facility.name === "nuclear_reactor") {
                                    displayValue = `${Math.round(1000 * amount)} g/MWh`;
                                } else {
                                    displayValue = `${(1000 * amount).toFixed(2)} g/MWh`;
                                }
                            } else {
                                displayName = `${resource.charAt(0).toUpperCase() + resource.slice(1)} consumption`;
                                displayValue = `${formatMass(amount)}/MWh`;
                            }

                            return (
                                <tr
                                    key={resource}
                                    className="border-b border-pine/10 dark:border-dark-border/30"
                                >
                                    <td className="py-2 px-4 font-semibold">
                                        {displayName}
                                    </td>
                                    <td className="py-2 px-4 text-center font-mono">
                                        {displayValue}
                                    </td>
                                </tr>
                            );
                        },
                    )}

                    {/* CO2 Emissions */}
                    {facility.pollution !== undefined &&
                        facility.pollution !== null && (
                            <tr className="border-b border-pine/10 dark:border-dark-border/30">
                                <td className="py-2 px-4 font-semibold">
                                    CO₂ emissions
                                </td>
                                <td className="py-2 px-4 text-center font-mono">
                                    {formatMass(facility.pollution)}/MWh
                                </td>
                            </tr>
                        )}

                    {/* Lifespan */}
                    <tr>
                        <td className="py-2 px-4 font-semibold">Lifespan</td>
                        <td className="py-2 px-4 text-center font-mono">
                            {formatDays(facility.lifespan)} days
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
