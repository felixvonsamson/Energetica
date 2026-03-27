import {
    createFileRoute,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { Info, HardHat } from "lucide-react";
import { useMemo, useState } from "react";

import {
    ProjectsPanel,
    ProjectsPanelToggle,
} from "@/components/dashboard/projects-panel";
import { FacilityItem, FacilityDetailDialog } from "@/components/facilities";
import { GameLayout } from "@/components/layout/game-layout";
import {
    ResourceName,
    CashFlow,
    Duration,
    CatalogGrid,
} from "@/components/ui";
import { usePlayerResources } from "@/hooks/use-player-resources";
import {
    useExtractionFacilitiesCatalog,
    useProjects,
} from "@/hooks/use-projects";
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
            isUnlocked: (cap) =>
                cap.has_warehouse
                    ? { unlocked: true }
                    : { unlocked: false, reason: "Build a Warehouse to unlock" },
        },
        infoDialog: {
            contents: <ExtractionFacilitiesHelp />,
        },
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): { facility?: string } => ({
        facility: search.facility ? String(search.facility) : undefined,
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
    const { facility } = useSearch({
        from: "/app/facilities/extraction",
    });
    const { data: projectsData } = useProjects();
    const constructionCount = projectsData?.construction_queue.length ?? 0;
    const [projectsPanelOpen, setProjectsPanelOpen] = useState(false);

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

    return (
        <div className="p-4 md:p-8">
            {/* Construction projects panel — very top, full width */}
            <ProjectsPanel
                projectCategory="construction"
                icon={HardHat}
                panelTitle="Under Construction"
                isOpen={projectsPanelOpen}
            />

            <div className="flex justify-end mb-6">
                <ProjectsPanelToggle
                    count={constructionCount}
                    icon={HardHat}
                    buttonLabel="Construction Projects"
                    isOpen={projectsPanelOpen}
                    onToggle={() => setProjectsPanelOpen((p) => !p)}
                />
            </div>

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

                    {/* Detail Dialog */}
                    <FacilityDetailDialog<ExtractionFacility>
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
