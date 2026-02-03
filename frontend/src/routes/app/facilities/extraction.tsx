import {
    createFileRoute,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { Info, HardHat } from "lucide-react";
import { useMemo } from "react";

import { ConstructionProjectsModal } from "@/components/dashboard/construction-projects-modal";
import { FacilityItem, FacilityDetailModal } from "@/components/facilities";
import { GameLayout } from "@/components/layout/game-layout";
import {
    ResourceName,
    CashFlow,
    Duration,
    CatalogGrid,
    Button,
} from "@/components/ui";
import { usePlayerResources } from "@/hooks/usePlayerResources";
import {
    useExtractionFacilitiesCatalog,
    useProjects,
} from "@/hooks/useProjects";
import { formatPower, formatMass } from "@/lib/format-utils";
import { ExtractionFacility } from "@/types/projects";

function ExtractionFacilitiesHelp() {
    return (
        <div className="space-y-3">
            <p>
                On this page you will find all the facilities that can extract
                natural resources from the ground and their respective
                information.
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
                For more information about Extraction Facilities, refer to{" "}
                <a
                    href="/wiki/resources#Extraction_Facilities"
                    className="underline hover:opacity-80 text-foreground"
                >
                    this section in the wiki
                </a>
                .
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/facilities/extraction")({
    component: ExtractionFacilitiesPage,
    staticData: {
        title: "Extraction Facilities",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: (cap) => cap.has_warehouse,
        },
        infoModal: {
            contents: <ExtractionFacilitiesHelp />,
        },
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): { facility?: string; projects?: boolean } => ({
        facility: search.facility ? String(search.facility) : undefined,
        projects:
            search.projects === "true" || search.projects === true
                ? true
                : undefined,
    }),
});

function ExtractionFacilitiesPage() {
    return (
        <GameLayout>
            <ExtractionFacilitiesContent />
        </GameLayout>
    );
}

function ExtractionFacilitiesContent() {
    const navigate = useNavigate({ from: "/app/facilities/extraction" });
    const { facility, projects } = useSearch({
        from: "/app/facilities/extraction",
    });
    const { data: projectsData } = useProjects();

    const {
        data: catalogData,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
    } = useExtractionFacilitiesCatalog();

    const { data: resourcesData } = usePlayerResources();

    const facilities = useMemo(
        () => catalogData?.extraction_facilities ?? [],
        [catalogData?.extraction_facilities],
    );

    // Find selected facility from URL param
    const selectedFacility = useMemo(
        () => facilities.find((f) => f.name === facility) || null,
        [facilities, facility],
    );

    // Check if there are any construction projects
    const hasConstructionProjects =
        (projectsData?.construction_queue.length ?? 0) > 0;

    return (
        <div className="p-4 md:p-8">
            {/* Construction projects button - only shown if there are ongoing projects */}
            {hasConstructionProjects && (
                <div className="mb-6 flex justify-center">
                    <Button
                        variant="outline"
                        onClick={() =>
                            navigate({
                                search: (prev) => ({ ...prev, projects: true }),
                            })
                        }
                        className="flex items-center gap-2"
                    >
                        <HardHat className="w-5 h-5" />
                        View Construction Projects
                    </Button>
                </div>
            )}

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

            {/* Facilities grid */}
            {!isCatalogLoading && facilities.length > 0 && (
                <>
                    <CatalogGrid>
                        {facilities.map((facility) => (
                            <FacilityItem
                                key={facility.name}
                                facilityName={facility.name}
                                facilityType="extraction"
                                price={facility.price}
                                isLocked={
                                    facility.requirements_status ===
                                    "unsatisfied"
                                }
                                onClick={() =>
                                    navigate({
                                        search: { facility: facility.name },
                                    })
                                }
                            />
                        ))}
                    </CatalogGrid>

                    {/* Detail Modal */}
                    <FacilityDetailModal<ExtractionFacility>
                        isOpen={selectedFacility !== null}
                        onClose={() => navigate({ search: {} })}
                        facility={selectedFacility}
                        facilityType="extraction"
                        renderDescription={(facility) => (
                            <div>
                                <div
                                    className="mb-2"
                                    dangerouslySetInnerHTML={{
                                        __html: facility.description,
                                    }}
                                />

                                {/* Underground reserves indicator */}
                                {resourcesData && (
                                    <div className="text-blue-600 dark:text-blue-400 italic flex items-center gap-1 mt-2">
                                        <Info className="w-4 h-4 shrink-0" />
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
                                                    resourcesData[
                                                        facility
                                                            .resource_production
                                                            .name
                                                    ].reserves,
                                                )}
                                            </strong>
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                        renderStatsTable={(facility) => (
                            <ExtractionFacilityStatsTable facility={facility} />
                        )}
                    />
                </>
            )}

            {/* Construction Projects Modal */}
            <ConstructionProjectsModal
                isOpen={projects === true}
                onClose={() =>
                    navigate({
                        search: (prev) => ({ ...prev, projects: undefined }),
                    })
                }
            />
        </div>
    );
}

interface ExtractionFacilityStatsTableProps {
    facility: ExtractionFacility;
}

function ExtractionFacilityStatsTable({
    facility,
}: ExtractionFacilityStatsTableProps) {
    const resourceName =
        facility.resource_production.name.charAt(0).toUpperCase() +
        facility.resource_production.name.slice(1);

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
                <tbody className="bg-muted/30">
                    {/* Power Consumption */}
                    <tr className="border-b border-border/30">
                        <td className="py-2 px-4 font-semibold">
                            Power consumption
                        </td>
                        <td className="py-2 px-4 text-center font-mono">
                            {formatPower(facility.power_consumption)}
                        </td>
                    </tr>

                    {/* Resource Production */}
                    <tr className="border-b border-border/30">
                        <td className="py-2 px-4 font-semibold">
                            {resourceName} production
                        </td>
                        <td className="py-2 px-4 text-center font-mono">
                            {formatMass(facility.resource_production.rate)}/h
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

                    {/* CO2 Emissions */}
                    <tr className="border-b border-border/30">
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
                            <Duration ticks={facility.lifespan} />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
