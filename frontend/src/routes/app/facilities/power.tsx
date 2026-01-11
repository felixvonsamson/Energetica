import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
    ResourceStockIndicators,
    FacilityItem,
    FacilityDetailModal,
} from "@/components/facilities";
import { GameLayout } from "@/components/layout/GameLayout";
import { CashFlow, TogglingDuration, CatalogGrid } from "@/components/ui";
import { usePlayerResources } from "@/hooks/usePlayerResources";
import { usePowerFacilitiesCatalog } from "@/hooks/useProjects";
import { formatPower, formatMass } from "@/lib/format-utils";
import type { ApiSchema } from "@/types/api-helpers";

function PowerFacilitiesHelp() {
    return (
        <div className="space-y-3">
            <p>
                On this page you will find all the facilities that generate
                electricity and their respective information.
            </p>
            <p>
                Click on any facility to open a detailed view with full
                specifications and a button to start construction.
            </p>
            <p>
                Some facilities might be locked and require certain technologies
                to be unlocked. To research technologies, you need a laboratory.
            </p>
            <p>
                For more information about power facilities, refer to{" "}
                <a
                    href="/wiki/power_facilities"
                    className="underline hover:opacity-80 text-foreground"
                >
                    this section in the wiki
                </a>
                .
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/facilities/power")({
    component: PowerFacilitiesPage,
    staticData: {
        title: "Power Facilities",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
        },
        infoModal: {
            contents: <PowerFacilitiesHelp />,
        },
    },
});

function PowerFacilitiesPage() {
    return (
        <GameLayout>
            <PowerFacilitiesContent />
        </GameLayout>
    );
}

type PowerFacility = ApiSchema<"PowerFacilityCatalogOut">;

function PowerFacilitiesContent() {
    const {
        data: catalogData,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
    } = usePowerFacilitiesCatalog();

    const { data: resourcesData, isLoading: isResourcesLoading } =
        usePlayerResources();

    const facilities = catalogData?.power_facilities ?? [];
    const [selectedFacility, setSelectedFacility] =
        useState<PowerFacility | null>(null);

    // Extract stock values from resource data
    const playerResources = resourcesData
        ? {
              coal: resourcesData.coal.stock,
              gas: resourcesData.gas.stock,
              uranium: resourcesData.uranium.stock,
          }
        : { coal: 0, gas: 0, uranium: 0 };

    // Image extension map for facilities that use PNG instead of JPG
    const imageExtensionMap = {
        combined_cycle: "png" as const,
        nuclear_reactor_gen4: "png" as const,
        steam_engine: "png" as const,
    };

    return (
        <div className="p-4 md:p-8">
            {/* Title */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Power Facilities
                </h1>
            </div>

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

            {/* Facilities grid */}
            {!isCatalogLoading &&
                !isResourcesLoading &&
                facilities.length > 0 && (
                    <>
                        <CatalogGrid>
                            {facilities.map((facility) => (
                                <FacilityItem
                                    key={facility.name}
                                    facilityName={facility.name}
                                    facilityType="power"
                                    price={facility.price}
                                    isLocked={
                                        facility.requirements_status ===
                                        "unsatisfied"
                                    }
                                    imageExtension={
                                        imageExtensionMap[
                                            facility.name as keyof typeof imageExtensionMap
                                        ]
                                    }
                                    onClick={() =>
                                        setSelectedFacility(facility)
                                    }
                                />
                            ))}
                        </CatalogGrid>

                        {/* Detail Modal */}
                        {selectedFacility && (
                            <FacilityDetailModal
                                isOpen={selectedFacility !== null}
                                onClose={() => setSelectedFacility(null)}
                                facility={selectedFacility}
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
                                imageExtension={
                                    imageExtensionMap[
                                        selectedFacility.name as keyof typeof imageExtensionMap
                                    ]
                                }
                            />
                        )}
                    </>
                )}
        </div>
    );
}

interface PowerFacilityStatsTableProps {
    facility: PowerFacility;
}

function PowerFacilityStatsTable({ facility }: PowerFacilityStatsTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
                <tbody className="bg-muted/30">
                    {/* Max Generation */}
                    <tr className="border-b border-border/30">
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
                            <tr className="border-b border-border/30">
                                <td className="py-2 px-4 font-semibold">
                                    Ramping speed
                                </td>
                                <td className="py-2 px-4 text-center font-mono">
                                    {formatPower(facility.ramping_speed)}/min
                                </td>
                            </tr>
                        )}

                    {/* Operation Cost */}
                    <tr className="border-b border-border/30">
                        <td className="py-2 px-4 font-semibold">
                            Operation cost
                        </td>
                        <td className="py-2 px-4 text-center">
                            <CashFlow
                                amountPerTick={facility.operating_costs}
                            />
                        </td>
                    </tr>

                    {/* Capacity Factor */}
                    {facility.capacity_factor && (
                        <tr className="border-b border-border/30">
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
                                    className="border-b border-border/30"
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
                            <tr className="border-b border-border/30">
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
                            <TogglingDuration ticks={facility.lifespan} />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
