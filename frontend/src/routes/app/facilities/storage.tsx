import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { FacilityItem, FacilityDetailModal } from "@/components/facilities";
import { GameLayout } from "@/components/layout/GameLayout";
import { CashFlow, Duration, CatalogGrid } from "@/components/ui";
import { useStorageFacilitiesCatalog } from "@/hooks/useProjects";
import { formatPower, formatEnergy } from "@/lib/format-utils";
import type { ApiSchema } from "@/types/api-helpers";

function StorageFacilitiesHelp() {
    return (
        <div className="space-y-3">
            <p>
                On this page you will find all the facilities that can store
                energy and their respective information.
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
                For more information about storage facilities, refer to{" "}
                <a
                    href="/wiki/storage_facilities"
                    className="underline hover:opacity-80 text-foreground"
                >
                    this section in the wiki
                </a>
                .
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/facilities/storage")({
    component: StorageFacilitiesPage,
    staticData: {
        title: "Storage Facilities",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
        },
        infoModal: {
            contents: <StorageFacilitiesHelp />,
        },
    },
});

function StorageFacilitiesPage() {
    return (
        <GameLayout>
            <StorageFacilitiesContent />
        </GameLayout>
    );
}

type StorageFacility = ApiSchema<"StorageFacilityCatalogOut">;

function StorageFacilitiesContent() {
    const {
        data: catalogData,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
    } = useStorageFacilitiesCatalog();

    const facilities = catalogData?.storage_facilities ?? [];
    const [selectedFacility, setSelectedFacility] =
        useState<StorageFacility | null>(null);

    // Image extension map for facilities that use PNG instead of JPG
    const imageExtensionMap = {
        small_pumped_hydro: "png" as const,
    };

    return (
        <div className="p-4 md:p-8">
            {/* Title */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Storage Facilities
                </h1>
            </div>

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
                    Failed to load storage facilities. Please try again.
                </div>
            )}

            {/* Facilities grid */}
            {!isCatalogLoading && facilities.length > 0 && (
                <>
                    <CatalogGrid>
                        {facilities.map((facility) => (
                            <FacilityItem
                                key={facility.name}
                                facilityName={facility.name}
                                facilityType="storage"
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
                                onClick={() => setSelectedFacility(facility)}
                            />
                        ))}
                    </CatalogGrid>

                    {/* Detail Modal */}
                    {selectedFacility && (
                        <FacilityDetailModal
                            isOpen={selectedFacility !== null}
                            onClose={() => setSelectedFacility(null)}
                            facility={selectedFacility}
                            facilityType="storage"
                            renderStatsTable={(facility) => (
                                <StorageFacilityStatsTable
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

interface StorageFacilityStatsTableProps {
    facility: StorageFacility;
}

function StorageFacilityStatsTable({
    facility,
}: StorageFacilityStatsTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
                <tbody className="bg-muted/30">
                    {/* Storage Capacity */}
                    <tr className="border-b border-border/30">
                        <td className="py-2 px-4 font-semibold">
                            Storage capacity
                        </td>
                        <td className="py-2 px-4 text-center font-mono">
                            {formatEnergy(facility.storage_capacity)}
                        </td>
                    </tr>

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

                    {/* Efficiency */}
                    <tr className="border-b border-border/30">
                        <td className="py-2 px-4 font-semibold">Efficiency</td>
                        <td className="py-2 px-4 text-center font-mono">
                            {Math.round(facility.efficiency)}%
                        </td>
                    </tr>

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

                    {/* Lifespan */}
                    <tr>
                        <td className="py-2 px-4 font-semibold">Lifespan</td>
                        <td className="py-2 px-4 text-center font-mono">
                            <Duration ticks={facility.lifespan} />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
