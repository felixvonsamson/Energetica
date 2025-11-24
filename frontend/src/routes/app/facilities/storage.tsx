import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HelpCircle, ExternalLink } from "lucide-react";

import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout/GameLayout";
import { Modal, Card, Money, FacilityName } from "@/components/ui";
import {
    useStorageFacilitiesCatalog,
    useQueueProject,
} from "@/hooks/useProjects";
import type { ApiSchema } from "@/types/api-helpers";
import { RequirementsDisplay, ConstructionInfo } from "@/components/facilities";
import { formatPower, formatEnergy } from "@/lib/format-utils";

export const Route = createFileRoute("/app/facilities/storage")({
    component: StorageFacilitiesPage,
    staticData: {
        title: "Storage Facilities",
    },
});

function StorageFacilitiesPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <StorageFacilitiesContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

// ============================================================================
// Types
// ============================================================================

type StorageFacility = ApiSchema<"StorageFacilityCatalogOut">;

// ============================================================================
// Main Content Component
// ============================================================================

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
                        <FacilityCard key={facility.name} facility={facility} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Facility Card Component (Reusable)
// ============================================================================

interface FacilityCardProps {
    facility: StorageFacility;
}

function FacilityCard({ facility }: FacilityCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const queueProjectMutation = useQueueProject();

    const handleConstruction = () => {
        queueProjectMutation.mutate({ type: facility.name });
    };

    // Determine image extension
    const pngExtensions = ["small_pumped_hydro"];
    const imageExtension = pngExtensions.includes(facility.name)
        ? "png"
        : "jpg";
    const imageUrl = `/static/images/storage_facilities/${facility.name}.${imageExtension}`;

    return (
        <Card
            className="cursor-pointer hover:border-brand-green transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="flex flex-col lg:flex-row gap-4">
                {/* Image */}
                <div className="flex-shrink-0">
                    <img
                        src={imageUrl}
                        alt={`${facility.name} storage facility`}
                        className="w-full lg:w-64 h-auto rounded"
                    />
                </div>

                {/* Main Info */}
                <div className="flex-grow space-y-3">
                    {/* Header */}
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold">
                            <FacilityName
                                facility={facility.name}
                                mode="long"
                            />
                        </h2>
                        <a
                            href={facility.wikipedia_link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-white hover:opacity-80"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink className="w-5 h-5" />
                        </a>
                        <div className="text-lg font-semibold">
                            <Money amount={facility.price} iconSize="md" long />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="text-sm">
                        <div
                            className="mb-2"
                            dangerouslySetInnerHTML={{
                                __html: facility.description,
                            }}
                        />
                    </div>

                    {/* Requirements */}
                    {facility.requirements_status !== "satisfied" && (
                        <RequirementsDisplay
                            requirements={facility.requirements}
                        />
                    )}
                </div>

                {/* Stats Table (visible on desktop when not expanded) */}
                {!isExpanded && (
                    <div className="hidden xl:block flex-shrink-0">
                        <StorageFacilityStatsTable facility={facility} />
                    </div>
                )}
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="mt-6 pt-6 border-t border-pine/20 dark:border-dark-border/50">
                    {/* Construction Info & Button */}
                    <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleConstruction();
                            }}
                            disabled={
                                facility.requirements_status === "unsatisfied"
                            }
                            className={`px-6 py-3 rounded font-bold text-white transition-colors ${
                                facility.requirements_status === "unsatisfied"
                                    ? "bg-alert-red cursor-not-allowed"
                                    : "bg-brand-green hover:bg-brand-green/80"
                            }`}
                        >
                            {facility.requirements_status === "unsatisfied"
                                ? "Locked"
                                : "Start Construction"}
                        </button>

                        <ConstructionInfo
                            constructionTime={facility.construction_time}
                            constructionPower={facility.construction_power}
                            constructionPollution={
                                facility.construction_pollution
                            }
                        />
                    </div>

                    {/* Full Stats Table */}
                    <StorageFacilityStatsTable facility={facility} />
                </div>
            )}
        </Card>
    );
}

// ============================================================================
// Storage Facility Stats Table Component
// ============================================================================

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
