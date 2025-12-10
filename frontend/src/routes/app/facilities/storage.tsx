import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HelpCircle } from "lucide-react";

import { GameLayout } from "@/components/layout/GameLayout";
import { Modal, Money } from "@/components/ui";
import { useStorageFacilitiesCatalog } from "@/hooks/useProjects";
import type { ApiSchema } from "@/types/api-helpers";
import { FacilityCard } from "@/components/facilities/FacilityCard";
import { formatPower, formatEnergy } from "@/lib/format-utils";

export const Route = createFileRoute("/app/facilities/storage")({
    component: StorageFacilitiesPage,
    staticData: {
        title: "Storage Facilities",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
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
    const [showInfoPopup, setShowInfoPopup] = useState(false);

    const {
        data: catalogData,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
    } = useStorageFacilitiesCatalog();

    const facilities = catalogData?.storage_facilities ?? [];

    return (
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Storage Facilities
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
                title="Help : Storage Facilities"
            >
                <div className="space-y-3">
                    <p>
                        On this page you will find all the facilities that can
                        store energy and their respective information.
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
                        For more information about storage facilities, refer to{" "}
                        <a
                            href="/wiki/storage_facilities"
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
                    Failed to load storage facilities. Please try again.
                </div>
            )}

            {/* Facilities list */}
            {!isCatalogLoading && facilities.length > 0 && (
                <div className="space-y-4">
                    {facilities.map((facility) => (
                        <FacilityCard
                            key={facility.name}
                            facility={facility}
                            facilityType="storage"
                            renderStatsTable={(facility) => (
                                <StorageFacilityStatsTable
                                    facility={facility}
                                />
                            )}
                            imageExtensionMap={{
                                small_pumped_hydro: "png",
                            }}
                        />
                    ))}
                </div>
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
    // TODO: Format days properly when we have game constants
    const formatDays = (ticks: number) => {
        return Math.round(ticks / 100); // Placeholder
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
                <tbody className="bg-tan-green/20 dark:bg-dark-bg-tertiary/30">
                    {/* Storage Capacity */}
                    <tr className="border-b border-pine/10 dark:border-dark-border/30">
                        <td className="py-2 px-4 font-semibold">
                            Storage capacity
                        </td>
                        <td className="py-2 px-4 text-center font-mono">
                            {formatEnergy(facility.storage_capacity)}
                        </td>
                    </tr>

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

                    {/* Efficiency */}
                    <tr className="border-b border-pine/10 dark:border-dark-border/30">
                        <td className="py-2 px-4 font-semibold">Efficiency</td>
                        <td className="py-2 px-4 text-center font-mono">
                            {Math.round(facility.efficiency * 100)}%
                        </td>
                    </tr>

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
