import {
    createFileRoute,
    useNavigate,
    useSearch,
} from "@tanstack/react-router";
import { GitCompareArrows, HardHat } from "lucide-react";
import { useMemo, useState } from "react";

import {
    ProjectsPanel,
    ProjectsPanelToggle,
} from "@/components/dashboard/projects-panel";
import {
    ResourceStockIndicators,
    FacilityItem,
    FacilityDetailDialog,
    FacilityComparisonDialog,
} from "@/components/facilities";
import { GameLayout } from "@/components/layout/game-layout";
import {
    CashFlow,
    Duration,
    DualDuration,
    CatalogGrid,
    Money,
    Button,
} from "@/components/ui";
import { usePlayerResources } from "@/hooks/use-player-resources";
import { usePowerFacilitiesCatalog, useProjects } from "@/hooks/use-projects";
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
            isUnlocked: () => ({ unlocked: true }),
        },
        infoDialog: {
            contents: <PowerFacilitiesHelp />,
        },
    },
    validateSearch: (
        search: Record<string, unknown>,
    ): { facility?: string; compare?: string } => ({
        facility: search.facility ? String(search.facility) : undefined,
        compare:
            search.compare !== undefined ? String(search.compare) : undefined,
    }),
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
    const navigate = useNavigate({ from: "/app/facilities/power" });
    const { facility, compare } = useSearch({
        from: "/app/facilities/power",
    });
    const { data: projectsData } = useProjects();
    const constructionCount = projectsData?.construction_queue.length ?? 0;
    const [projectsPanelOpen, setProjectsPanelOpen] = useState(false);

    const {
        data: catalogData,
        isLoading: isCatalogLoading,
        isError: isCatalogError,
    } = usePowerFacilitiesCatalog();

    const { data: resourcesData, isLoading: isResourcesLoading } =
        usePlayerResources();

    const facilities = useMemo(
        () => catalogData?.power_facilities ?? [],
        [catalogData?.power_facilities],
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
            {/* Construction projects panel — very top, full width */}
            <ProjectsPanel
                projectCategory="construction"
                icon={HardHat}
                panelTitle="Under Construction"
                isOpen={projectsPanelOpen}
            />

            <div className="flex justify-end gap-3 mb-6">
                <ProjectsPanelToggle
                    count={constructionCount}
                    icon={HardHat}
                    buttonLabel="Construction Projects"
                    isOpen={projectsPanelOpen}
                    onToggle={() => setProjectsPanelOpen((p) => !p)}
                />
                <Button
                    onClick={() =>
                        navigate({
                            search: { compare: "" },
                        })
                    }
                    className="px-4 py-2 rounded-lg bg-brand text-white font-semibold hover:bg-brand/80 transition-colors flex items-center gap-2"
                >
                    <GitCompareArrows className="w-5 h-5" />
                    Compare
                </Button>
            </div>

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
                                    onClick={() =>
                                        navigate({
                                            search: { facility: facility.name },
                                        })
                                    }
                                />
                            ))}
                        </CatalogGrid>

                        {/* Detail Dialog */}
                        <FacilityDetailDialog
                            isOpen={selectedFacility !== null}
                            onClose={() => navigate({ search: {} })}
                            facility={selectedFacility}
                            facilityType="power"
                            onCompare={(facility) =>
                                navigate({
                                    search: {
                                        compare: facility.name,
                                    },
                                })
                            }
                            renderDescription={(facility, learnMore) => (
                                <div>
                                    <div
                                        dangerouslySetInnerHTML={{
                                            __html: facility.description,
                                        }}
                                    />
                                    {learnMore}
                                    <ResourceStockIndicators
                                        facilityName={facility.name}
                                        windPotential={facility.wind_potential}
                                        solarPotential={
                                            facility.solar_potential
                                        }
                                        hydroPotential={
                                            facility.hydro_potential
                                        }
                                        highHydroCost={facility.high_hydro_cost}
                                        lowWindSpeed={facility.low_wind_speed}
                                        playerResources={playerResources}
                                    />
                                </div>
                            )}
                            renderStatsTable={(facility) => (
                                <PowerFacilityStatsTable facility={facility} />
                            )}
                        />

                        {/* Comparison Dialog */}
                        <FacilityComparisonDialog
                            isOpen={compare !== undefined}
                            onClose={() => navigate({ search: {} })}
                            facilities={facilities}
                            facilityType="power"
                            selectedFacilityNames={compareNames}
                            onSelectionChange={handleComparisonChange}
                            onFacilityClick={(facilityName) =>
                                navigate({ search: { facility: facilityName } })
                            }
                            getFacilityName={(facility) => facility.name}
                            renderComparisonRows={(selectedFacilities) => (
                                <PowerFacilityComparisonRows
                                    facilities={selectedFacilities}
                                />
                            )}
                        />
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
                            <Duration ticks={facility.lifespan} />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

interface PowerFacilityComparisonRowsProps {
    facilities: PowerFacility[];
}

function PowerFacilityComparisonRows({
    facilities,
}: PowerFacilityComparisonRowsProps) {
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

            {/* Capacity Factor */}
            <tr className="border-b border-border/30">
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    Capacity factor
                </td>
                {facilities.map((facility) => (
                    <td
                        key={facility.name}
                        className="py-2 px-4 text-center font-mono bg-muted/30"
                    >
                        {facility.capacity_factor || "N/A"}
                    </td>
                ))}
            </tr>

            {/* Coal Consumption */}
            <tr className="border-b border-border/30">
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    Coal consumption
                </td>
                {facilities.map((facility) => (
                    <td
                        key={facility.name}
                        className="py-2 px-4 text-center font-mono bg-muted/30"
                    >
                        {facility.consumed_resources.coal
                            ? `${formatMass(facility.consumed_resources.coal)}/MWh`
                            : "N/A"}
                    </td>
                ))}
            </tr>

            {/* Gas Consumption */}
            <tr className="border-b border-border/30">
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    Gas consumption
                </td>
                {facilities.map((facility) => (
                    <td
                        key={facility.name}
                        className="py-2 px-4 text-center font-mono bg-muted/30"
                    >
                        {facility.consumed_resources.gas
                            ? `${formatMass(facility.consumed_resources.gas)}/MWh`
                            : "N/A"}
                    </td>
                ))}
            </tr>

            {/* Uranium Consumption */}
            <tr className="border-b border-border/30">
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    Uranium consumption
                </td>
                {facilities.map((facility) => {
                    const amount = facility.consumed_resources.uranium;
                    let displayValue = "N/A";
                    if (amount) {
                        if (facility.name === "nuclear_reactor") {
                            displayValue = `${Math.round(1000 * amount)} g/MWh`;
                        } else {
                            displayValue = `${(1000 * amount).toFixed(2)} g/MWh`;
                        }
                    }
                    return (
                        <td
                            key={facility.name}
                            className="py-2 px-4 text-center font-mono bg-muted/30"
                        >
                            {displayValue}
                        </td>
                    );
                })}
            </tr>

            {/* CO2 Emissions */}
            <tr className="border-b border-border/30">
                <td className="py-2 px-4 font-semibold bg-muted/30 sticky left-0">
                    CO₂ emissions
                </td>
                {facilities.map((facility) => (
                    <td
                        key={facility.name}
                        className="py-2 px-4 text-center font-mono bg-muted/30"
                    >
                        {facility.pollution !== undefined &&
                        facility.pollution !== null
                            ? `${formatMass(facility.pollution)}/MWh`
                            : "N/A"}
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
                        <DualDuration ticks={facility.construction_time} />
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
