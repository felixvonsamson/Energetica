import {
    createFileRoute,
    useNavigate,
    useSearch,
    Link,
} from "@tanstack/react-router";
import { HardHat } from "lucide-react";
import { useMemo } from "react";

import { ConstructionProjectsModal } from "@/components/dashboard/ConstructionProjectsModal";
import { FacilityItem, FacilityDetailModal } from "@/components/facilities";
import { GameLayout } from "@/components/layout/GameLayout";
import { Money, CatalogGrid, Button } from "@/components/ui";
import {
    useFunctionalFacilitiesCatalog,
    useProjects,
} from "@/hooks/useProjects";
import {
    formatUpgradePower,
    formatUpgradeMass,
    formatUpgradeMassRate,
} from "@/lib/format-utils";
import type { ApiSchema } from "@/types/api-helpers";

function FunctionalFacilitiesHelp() {
    return (
        <div className="space-y-3">
            <p>
                On this page you will find facilities with unique abilities and
                their specific information.
            </p>
            <p>
                For more information about Functional Facilities, refer to{" "}
                <a
                    href="/wiki/functional_facilities"
                    className="underline hover:opacity-80 text-foreground"
                >
                    this section in the wiki
                </a>
                .
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/facilities/functional")({
    component: FunctionalFacilitiesPage,
    staticData: {
        title: "Functional Facilities",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
        },
        infoModal: {
            contents: <FunctionalFacilitiesHelp />,
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

function FunctionalFacilitiesPage() {
    return (
        <GameLayout>
            <FunctionalFacilitiesContent />
        </GameLayout>
    );
}

type FunctionalFacility = ApiSchema<"FunctionalFacilityCatalogOut">;

function FunctionalFacilitiesContent() {
    const navigate = useNavigate({ from: "/app/facilities/functional" });
    const { facility, projects } = useSearch({
        from: "/app/facilities/functional",
    });
    const { data: projectsData } = useProjects();

    const {
        data: catalogData,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
    } = useFunctionalFacilitiesCatalog();

    const facilities = useMemo(
        () => catalogData?.functional_facilities ?? [],
        [catalogData?.functional_facilities],
    );

    // Find selected facility from URL param
    const selectedFacility = useMemo(
        () => facilities.find((f) => f.name === facility) || null,
        [facilities, facility],
    );

    // Check if there are any construction projects
    const hasConstructionProjects =
        (projectsData?.construction_queue?.length ?? 0) > 0;

    return (
        <div className="p-4 md:p-8">
            {/* Title */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Functional Facilities
                </h1>
            </div>

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
                    Failed to load functional facilities. Please try again.
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
                                facilityType="functional"
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
                    {selectedFacility && (
                        <FacilityDetailModal
                            isOpen={selectedFacility !== null}
                            onClose={() => navigate({ search: {} })}
                            facility={selectedFacility}
                            facilityType="functional"
                            renderDescription={(facility) => {
                                // Custom descriptions for laboratory and warehouse
                                if (facility.name === "laboratory") {
                                    return (
                                        <>
                                            The laboratory is needed to research{" "}
                                            <strong>
                                                {/* TODO: disable link when locked */}
                                                <Link
                                                    className="text-blue-600 dark:text-blue-400"
                                                    to="/app/facilities/technology"
                                                >
                                                    Technologies
                                                </Link>
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
                                                {/* TODO: disable link when locked */}
                                                <Link
                                                    className="text-blue-600 dark:text-blue-400"
                                                    to="/app/facilities/extraction"
                                                >
                                                    resources
                                                </Link>
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
                    )}
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

interface FunctionalFacilityStatsTableProps {
    facility: FunctionalFacility;
}

function FunctionalFacilityStatsTable({
    facility,
}: FunctionalFacilityStatsTableProps) {
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
                    <tr className="bg-muted/30">
                        <th className="py-2 px-4 text-left font-semibold">
                            Effects:
                        </th>
                        <th className="py-2 px-4 text-center font-semibold">
                            lvl {facility.level - 1} → lvl {facility.level}
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-muted/30">
                    {/* Average Consumption (Industry) */}
                    {facility.average_consumption && (
                        <tr className="border-b border-border/30">
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
                        <tr className="border-b border-border/30">
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
                            <tr className="border-b border-border/30">
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
                            <tr className="border-b border-border/30">
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
                            <tr className="border-b border-border/30">
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
                            <tr className="border-b border-border/30">
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
                            <tr className="border-b border-border/30">
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
                        <tr className="border-b border-border/30">
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
