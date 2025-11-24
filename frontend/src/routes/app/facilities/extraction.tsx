import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HelpCircle, ExternalLink, Info } from "lucide-react";

import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout/GameLayout";
import {
    Modal,
    Card,
    Money,
    FacilityName,
    ResourceName,
} from "@/components/ui";
import {
    useExtractionFacilitiesCatalog,
    useQueueProject,
} from "@/hooks/useProjects";
import { usePlayerResources } from "@/hooks/usePlayerResources";
import type { ApiSchema } from "@/types/api-helpers";
import { RequirementsDisplay, ConstructionInfo } from "@/components/facilities";
import { formatPower, formatMass, formatMassRate } from "@/lib/format-utils";

export const Route = createFileRoute("/app/facilities/extraction")({
    component: ExtractionFacilitiesPage,
    staticData: {
        title: "Extraction Facilities",
    },
});

function ExtractionFacilitiesPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <ExtractionFacilitiesContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

// ============================================================================
// Types
// ============================================================================

type ExtractionFacility = ApiSchema<"ExtractionFacilityCatalogOut">;

// ============================================================================
// Main Content Component
// ============================================================================

function ExtractionFacilitiesContent() {
    const [showInfoPopup, setShowInfoPopup] = useState(false);

    const {
        data: catalogData,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
    } = useExtractionFacilitiesCatalog();

    const { data: resourcesData, isLoading: isResourcesLoading } =
        usePlayerResources();

    const facilities = catalogData?.extraction_facilities ?? [];

    return (
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Extraction Facilities
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
                title="Help : Extraction Facilities"
            >
                <div className="space-y-3">
                    <p>
                        On this page you will find all the facilities that can
                        extract natural resources from the ground and their
                        respective information.
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
                        For more information about Extraction Facilities, refer
                        to{" "}
                        <a
                            href="/wiki/resources#Extraction_Facilities"
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
                    Failed to load extraction facilities. Please try again.
                </div>
            )}

            {/* Facilities list */}
            {!isCatalogLoading && facilities.length > 0 && (
                <div className="space-y-4">
                    {facilities.map((facility) => (
                        <FacilityCard
                            key={facility.name}
                            facility={facility}
                            reserves={resourcesData}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Facility Card Component
// ============================================================================

interface FacilityCardProps {
    facility: ExtractionFacility;
    reserves?: {
        coal?: { reserves: number };
        gas?: { reserves: number };
        uranium?: { reserves: number };
    };
}

function FacilityCard({ facility, reserves }: FacilityCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const queueProjectMutation = useQueueProject();

    const handleConstruction = () => {
        queueProjectMutation.mutate({ type: facility.name });
    };

    // All extraction facility images are JPG
    const imageUrl = `/static/images/extraction_facilities/${facility.name}.jpg`;

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
                        alt={`${facility.name} extraction facility`}
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

                        {/* Underground reserves indicator */}
                        {reserves &&
                            reserves[
                                facility.resource_production
                                    .name as keyof typeof reserves
                            ] && (
                                <div className="text-blue-600 dark:text-blue-400 italic flex items-center gap-1 mt-2">
                                    <Info className="w-4 h-4 flex-shrink-0" />
                                    <span>
                                        Underground reserves of{" "}
                                        <ResourceName
                                            resource={
                                                facility.resource_production
                                                    .name
                                            }
                                        />
                                        :{" "}
                                        <strong>
                                            {formatMass(
                                                reserves[
                                                    facility.resource_production
                                                        .name as keyof typeof reserves
                                                ]?.reserves ?? 0,
                                            )}
                                        </strong>
                                    </span>
                                </div>
                            )}
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
                        <ExtractionFacilityStatsTable facility={facility} />
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
                    <ExtractionFacilityStatsTable facility={facility} />
                </div>
            )}
        </Card>
    );
}

// ============================================================================
// Extraction Facility Stats Table Component
// ============================================================================

interface ExtractionFacilityStatsTableProps {
    facility: ExtractionFacility;
}

function ExtractionFacilityStatsTable({
    facility,
}: ExtractionFacilityStatsTableProps) {
    // TODO: Format days properly when we have game constants
    const formatDays = (ticks: number) => {
        return Math.round(ticks / 100); // Placeholder
    };

    const resourceName =
        facility.resource_production.name.charAt(0).toUpperCase() +
        facility.resource_production.name.slice(1);

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
                <tbody className="bg-tan-green/20 dark:bg-dark-bg-tertiary/30">
                    {/* Power Consumption */}
                    <tr className="border-b border-pine/10 dark:border-dark-border/30">
                        <td className="py-2 px-4 font-semibold">
                            Power consumption
                        </td>
                        <td className="py-2 px-4 text-center font-mono">
                            {formatPower(facility.power_consumption)}
                        </td>
                    </tr>

                    {/* Resource Production */}
                    <tr className="border-b border-pine/10 dark:border-dark-border/30">
                        <td className="py-2 px-4 font-semibold">
                            {resourceName} production
                        </td>
                        <td className="py-2 px-4 text-center font-mono">
                            {formatMass(facility.resource_production.rate)}/h
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

                    {/* CO2 Emissions */}
                    <tr className="border-b border-pine/10 dark:border-dark-border/30">
                        <td className="py-2 px-4 font-semibold">
                            CO₂ emissions
                        </td>
                        <td className="py-2 px-4 text-center font-mono">
                            {formatMass(facility.pollution)}/t
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
