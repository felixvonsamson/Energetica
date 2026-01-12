import {
    createFileRoute,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { GitCompareArrows, HardHat } from "lucide-react";
import { useMemo } from "react";

import { ConstructionProjectsModal } from "@/components/dashboard/ConstructionProjectsModal";
import {
    FacilityItem,
    FacilityDetailModal,
    FacilityComparisonModal,
} from "@/components/facilities";
import { GameLayout } from "@/components/layout/GameLayout";
import {
    CashFlow,
    Duration,
    CatalogGrid,
    Money,
    Button,
} from "@/components/ui";
import { useStorageFacilitiesCatalog, useProjects } from "@/hooks/useProjects";
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
    validateSearch: (
        search: Record<string, unknown>,
    ): { facility?: string; compare?: string; projects?: boolean } => ({
        facility: search.facility ? String(search.facility) : undefined,
        compare:
            search.compare !== undefined ? String(search.compare) : undefined,
        projects:
            search.projects === "true" || search.projects === true
                ? true
                : undefined,
    }),
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
    const navigate = useNavigate({ from: "/app/facilities/storage" });
    const { facility, compare, projects } = useSearch({
        from: "/app/facilities/storage",
    });
    const { data: projectsData } = useProjects();

    const {
        data: catalogData,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
    } = useStorageFacilitiesCatalog();

    const facilities = useMemo(
        () => catalogData?.storage_facilities ?? [],
        [catalogData?.storage_facilities],
    );

    // Find selected facility from URL param
    const selectedFacility = useMemo(
        () => facilities.find((f) => f.name === facility) || null,
        [facilities, facility],
    );

    // Parse comparison facility names from URL param
    const compareNames = useMemo(
        () => (compare ? compare.split(",").filter(Boolean) : []),
        [compare],
    );

    const handleComparisonChange = (facilityNames: string[]) => {
        navigate({
            search: {
                compare:
                    facilityNames.length > 0
                        ? facilityNames.join(",")
                        : undefined,
            },
        });
    };

    // Check if there are any construction projects
    const hasConstructionProjects =
        (projectsData?.construction_queue?.length ?? 0) > 0;

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
                <button
                    onClick={() =>
                        navigate({
                            search: { compare: "" },
                        })
                    }
                    className="px-4 py-2 rounded-lg bg-brand-green text-white font-semibold hover:bg-brand-green/80 transition-colors flex items-center gap-2"
                >
                    <GitCompareArrows className="w-5 h-5" />
                    Compare
                </button>
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
                            facilityType="storage"
                            onCompare={() =>
                                navigate({
                                    search: {
                                        compare: selectedFacility.name,
                                    },
                                })
                            }
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

                    {/* Comparison Modal */}
                    <FacilityComparisonModal
                        isOpen={compare !== undefined}
                        onClose={() => navigate({ search: {} })}
                        facilities={facilities}
                        facilityType="storage"
                        selectedFacilityNames={compareNames}
                        onSelectionChange={handleComparisonChange}
                        onFacilityClick={(facilityName) =>
                            navigate({ search: { facility: facilityName } })
                        }
                        getFacilityName={(facility) => facility.name}
                        renderComparisonRows={(selectedFacilities) => (
                            <StorageFacilityComparisonRows
                                facilities={selectedFacilities}
                            />
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

interface StorageFacilityComparisonRowsProps {
    facilities: StorageFacility[];
}

function StorageFacilityComparisonRows({
    facilities,
}: StorageFacilityComparisonRowsProps) {
    return (
        <>
            {/* Price */}
            <tr className="border-b border-border/30">
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    Price
                </td>
                {facilities.map((facility) => (
                    <td
                        key={facility.name}
                        className="py-2 px-4 text-center bg-muted/30"
                    >
                        <Money amount={facility.price} long />
                    </td>
                ))}
            </tr>

            {/* Storage Capacity */}
            <tr className="border-b border-border/30">
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    Storage capacity
                </td>
                {facilities.map((facility) => (
                    <td
                        key={facility.name}
                        className="py-2 px-4 text-center font-mono bg-muted/30"
                    >
                        {formatEnergy(facility.storage_capacity)}
                    </td>
                ))}
            </tr>

            {/* Max Generation */}
            <tr className="border-b border-border/30">
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    Max generation
                </td>
                {facilities.map((facility) => (
                    <td
                        key={facility.name}
                        className="py-2 px-4 text-center font-mono bg-muted/30"
                    >
                        {formatPower(facility.power_generation)}
                    </td>
                ))}
            </tr>

            {/* Ramping Speed */}
            <tr className="border-b border-border/30">
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    Ramping speed
                </td>
                {facilities.map((facility) => (
                    <td
                        key={facility.name}
                        className="py-2 px-4 text-center font-mono bg-muted/30"
                    >
                        {facility.ramping_speed !== undefined &&
                        facility.ramping_speed !== null
                            ? `${formatPower(facility.ramping_speed)}/min`
                            : "N/A"}
                    </td>
                ))}
            </tr>

            {/* Efficiency */}
            <tr className="border-b border-border/30">
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    Efficiency
                </td>
                {facilities.map((facility) => (
                    <td
                        key={facility.name}
                        className="py-2 px-4 text-center font-mono bg-muted/30"
                    >
                        {Math.round(facility.efficiency)}%
                    </td>
                ))}
            </tr>

            {/* Operation Cost */}
            <tr className="border-b border-border/30">
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    Operation cost
                </td>
                {facilities.map((facility) => (
                    <td
                        key={facility.name}
                        className="py-2 px-4 text-center bg-muted/30"
                    >
                        <CashFlow amountPerTick={facility.operating_costs} />
                    </td>
                ))}
            </tr>

            {/* Construction Time */}
            <tr className="border-b border-border/30">
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    Construction time
                </td>
                {facilities.map((facility) => (
                    <td
                        key={facility.name}
                        className="py-2 px-4 text-center font-mono bg-muted/30"
                    >
                        <Duration ticks={facility.construction_time} />
                    </td>
                ))}
            </tr>

            {/* Construction Power */}
            <tr className="border-b border-border/30">
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    Construction power
                </td>
                {facilities.map((facility) => (
                    <td
                        key={facility.name}
                        className="py-2 px-4 text-center font-mono bg-muted/30"
                    >
                        {formatPower(facility.construction_power)}
                    </td>
                ))}
            </tr>

            {/* Lifespan */}
            <tr>
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    Lifespan
                </td>
                {facilities.map((facility) => (
                    <td
                        key={facility.name}
                        className="py-2 px-4 text-center font-mono bg-muted/30"
                    >
                        <Duration ticks={facility.lifespan} />
                    </td>
                ))}
            </tr>
        </>
    );
}
