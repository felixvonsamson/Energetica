import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HelpCircle, Clock, Zap, Cloud, ExternalLink } from "lucide-react";

import { RequireSettledPlayer } from "@/components/auth/ProtectedRoute";
import { GameLayout } from "@/components/layout/GameLayout";
import { Modal, Card, Money, FacilityName } from "@/components/ui";
import { formatPower, formatMass } from "@/lib/format-utils";

export const Route = createFileRoute("/app/facilities/power")({
    component: PowerFacilitiesPage,
    staticData: {
        title: "Power Facilities",
    },
});

function PowerFacilitiesPage() {
    return (
        <RequireSettledPlayer>
            <GameLayout>
                <PowerFacilitiesContent />
            </GameLayout>
        </RequireSettledPlayer>
    );
}

// ============================================================================
// Types
// ============================================================================

interface Requirement {
    name: string;
    display_name: string;
    level: number;
    status: "satisfied" | "unsatisfied";
}

interface FacilityData {
    name: string;
    display_name: string;
    description: string;
    price: number;
    construction_time: number;
    construction_power: number;
    construction_pollution?: number;
    power_generation: number;
    ramping_speed?: number;
    operating_costs: number;
    capacity_factor?: string;
    consumed_resources: Record<string, number>; // resource name -> amount
    pollution?: number;
    lifespan: number;
    wikipedia_link: string;
    requirements: Requirement[];
    requirements_status: "satisfied" | "unsatisfied";
    high_hydro_cost?: boolean;
    low_wind_speed?: boolean;
}

interface TilePotentials {
    wind: number;
    solar: number;
    hydro: number;
}

interface PlayerResources {
    coal: number;
    gas: number;
    uranium: number;
}

// ============================================================================
// Main Content Component
// ============================================================================

function PowerFacilitiesContent() {
    const [showInfoPopup, setShowInfoPopup] = useState(false);

    // TODO: Fetch real data from API
    const constructions: FacilityData[] = MOCK_FACILITIES;
    const tilePotentials: TilePotentials = MOCK_POTENTIALS;
    const playerResources: PlayerResources = MOCK_RESOURCES;

    return (
        <div className="p-4 md:p-8">
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Power Facilities
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
                title="Help : Power Facilities"
            >
                <div className="space-y-3">
                    <p>
                        On this page you will find all the facilities that
                        generate electricity and their respective information.
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
                        For more information about power facilities, refer to{" "}
                        <a
                            href="/wiki/power_facilities"
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

            {/* Facilities list */}
            <div className="space-y-4">
                {constructions.map((facility) => (
                    <FacilityCard
                        key={facility.name}
                        facility={facility}
                        tilePotentials={tilePotentials}
                        playerResources={playerResources}
                    />
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// Facility Card Component (Reusable)
// ============================================================================

interface FacilityCardProps {
    facility: FacilityData;
    tilePotentials: TilePotentials;
    playerResources: PlayerResources;
}

function FacilityCard({
    facility,
    tilePotentials,
    playerResources,
}: FacilityCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleConstruction = () => {
        // TODO: Implement construction launch
        console.log("Starting construction of", facility.name);
    };

    // Determine image extension
    const pngExtensions = [
        "combined_cycle",
        "nuclear_reactor_gen4",
        "steam_engine",
    ];
    const imageExtension = pngExtensions.includes(facility.name)
        ? "png"
        : "jpg";
    const imageUrl = `/static/images/power_facilities/${facility.name}.${imageExtension}`;

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
                        alt={`${facility.display_name} power plant`}
                        className="w-full lg:w-64 h-auto rounded"
                    />
                </div>

                {/* Main Info */}
                <div className="flex-grow space-y-3">
                    {/* Header */}
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold">
                            {facility.display_name}
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
                            <Money amount={facility.price} iconSize="md" />
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

                        {/* Potential Indicators */}
                        <PotentialIndicators
                            facility={facility}
                            tilePotentials={tilePotentials}
                            playerResources={playerResources}
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
                        <FacilityStatsTable facility={facility} />
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

                        <ConstructionInfo facility={facility} />
                    </div>

                    {/* Full Stats Table */}
                    <FacilityStatsTable facility={facility} />
                </div>
            )}
        </Card>
    );
}

// ============================================================================
// Potential Indicators Component (Reusable)
// ============================================================================

interface PotentialIndicatorsProps {
    facility: FacilityData;
    tilePotentials: TilePotentials;
    playerResources: PlayerResources;
}

function PotentialIndicators({
    facility,
    tilePotentials,
    playerResources,
}: PotentialIndicatorsProps) {
    const windFacilities = [
        "windmill",
        "onshore_wind_turbine",
        "offshore_wind_turbine",
    ];
    const solarFacilities = ["CSP_solar", "PV_solar"];
    const hydroFacilities = ["watermill", "small_water_dam", "large_water_dam"];

    const resourceFacilities: Record<string, string[]> = {
        gas: ["gas_burner", "combined_cycle"],
        coal: ["coal_burner", "combined_cycle"],
        uranium: ["nuclear_reactor", "nuclear_reactor_gen4"],
    };

    return (
        <>
            {/* Wind Potential */}
            {windFacilities.includes(facility.name) && (
                <div className="text-blue-600 dark:text-blue-400 italic">
                    <span className="mr-1">ℹ️</span>
                    Wind potential:{" "}
                    <strong>{Math.round(tilePotentials.wind * 100)}%</strong>
                </div>
            )}

            {/* Solar Potential */}
            {solarFacilities.includes(facility.name) && (
                <div className="text-blue-600 dark:text-blue-400 italic">
                    <span className="mr-1">ℹ️</span>
                    Solar potential:{" "}
                    <strong>{Math.round(tilePotentials.solar * 100)}%</strong>
                </div>
            )}

            {/* Hydro Potential */}
            {hydroFacilities.includes(facility.name) && (
                <div className="text-blue-600 dark:text-blue-400 italic">
                    <span className="mr-1">ℹ️</span>
                    Hydro potential:{" "}
                    <strong>{Math.round(tilePotentials.hydro * 100)}%</strong>
                </div>
            )}

            {/* Resource Stock */}
            {Object.entries(resourceFacilities).map(
                ([resource, facilities]) => {
                    if (facilities.includes(facility.name)) {
                        const stock =
                            playerResources[resource as keyof PlayerResources];
                        return (
                            <div
                                key={resource}
                                className="text-blue-600 dark:text-blue-400 italic"
                            >
                                <span className="mr-1">ℹ️</span>
                                Current stock of {resource}:{" "}
                                <strong>{formatMass(stock)}</strong>
                            </div>
                        );
                    }
                    return null;
                },
            )}
        </>
    );
}

// ============================================================================
// Requirements Display Component (Reusable)
// ============================================================================

interface RequirementsDisplayProps {
    requirements: Requirement[];
}

function RequirementsDisplay({ requirements }: RequirementsDisplayProps) {
    return (
        <div className="bg-tan-green/30 dark:bg-dark-bg-tertiary/50 p-3 rounded">
            <div className="font-bold mb-2">Unlock with:</div>
            <ul className="space-y-1 ml-4">
                {requirements.map((req, idx) => {
                    const techName =
                        req.name === "mechanical_engineering"
                            ? "Mech. engineering"
                            : req.display_name;
                    return (
                        <li
                            key={idx}
                            className={
                                req.status === "satisfied"
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                            }
                        >
                            - {techName} lvl {req.level}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

// ============================================================================
// Construction Info Component (Reusable)
// ============================================================================

interface ConstructionInfoProps {
    facility: FacilityData;
}

function ConstructionInfo({ facility }: ConstructionInfoProps) {
    // TODO: Format duration properly when we have game constants
    const formatDuration = (ticks: number) => {
        return `${ticks} ticks`;
    };

    return (
        <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <strong>{formatDuration(facility.construction_time)}</strong>
                <span className="text-xs text-gray-500">(Duration)</span>
            </div>
            <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <strong>{formatPower(facility.construction_power)}</strong>
                <span className="text-xs text-gray-500">(Power)</span>
            </div>
            {facility.construction_pollution !== undefined && (
                <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4" />
                    <strong>
                        {formatMass(facility.construction_pollution)} CO₂
                    </strong>
                    <span className="text-xs text-gray-500">(Emissions)</span>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Facility Stats Table Component (Reusable)
// ============================================================================

interface FacilityStatsTableProps {
    facility: FacilityData;
}

function FacilityStatsTable({ facility }: FacilityStatsTableProps) {
    // TODO: Format days properly when we have game constants
    const formatDays = (ticks: number) => {
        return Math.round(ticks / 100); // Placeholder
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
                <tbody className="bg-tan-green/20 dark:bg-dark-bg-tertiary/30">
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
                    {facility.ramping_speed !== undefined && (
                        <tr className="border-b border-pine/10 dark:border-dark-border/30">
                            <td className="py-2 px-4 font-semibold">
                                Ramping speed
                            </td>
                            <td className="py-2 px-4 text-center font-mono">
                                {formatPower(facility.ramping_speed)}/min
                            </td>
                        </tr>
                    )}

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

                    {/* Capacity Factor */}
                    {facility.capacity_factor && (
                        <tr className="border-b border-pine/10 dark:border-dark-border/30">
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
                                    className="border-b border-pine/10 dark:border-dark-border/30"
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
                    {facility.pollution !== undefined && (
                        <tr className="border-b border-pine/10 dark:border-dark-border/30">
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
                            {formatDays(facility.lifespan)} days
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

// ============================================================================
// Mock Data (TODO: Replace with API calls)
// ============================================================================

const MOCK_POTENTIALS: TilePotentials = {
    wind: 0.65,
    solar: 0.8,
    hydro: 0.45,
};

const MOCK_RESOURCES: PlayerResources = {
    coal: 15000,
    gas: 8000,
    uranium: 500,
};

const MOCK_FACILITIES: FacilityData[] = [
    {
        name: "coal_burner",
        display_name: "Coal Burner",
        description:
            "A basic coal-fired power plant that generates electricity by burning coal.",
        price: 50000,
        construction_time: 100,
        construction_power: 1000,
        construction_pollution: 5000,
        power_generation: 5000,
        ramping_speed: 500,
        operating_costs: 100,
        consumed_resources: { coal: 0.4 },
        pollution: 0.9,
        lifespan: 3650,
        wikipedia_link:
            "https://en.wikipedia.org/wiki/Coal-fired_power_station",
        requirements: [],
        requirements_status: "satisfied",
    },
    {
        name: "PV_solar",
        display_name: "Photovoltaic Solar Plant",
        description:
            "Converts sunlight directly into electricity using solar panels.",
        price: 120000,
        construction_time: 150,
        construction_power: 2000,
        power_generation: 10000,
        operating_costs: 50,
        capacity_factor: "Variable",
        consumed_resources: {},
        lifespan: 9125,
        wikipedia_link:
            "https://en.wikipedia.org/wiki/Photovoltaic_power_station",
        requirements: [
            {
                name: "solar_energy",
                display_name: "Solar Energy",
                level: 1,
                status: "unsatisfied",
            },
        ],
        requirements_status: "unsatisfied",
    },
    {
        name: "onshore_wind_turbine",
        display_name: "Onshore Wind Turbine",
        description:
            "Harnesses wind energy to generate clean electricity on land.",
        price: 80000,
        construction_time: 120,
        construction_power: 1500,
        power_generation: 8000,
        operating_costs: 75,
        capacity_factor: "Variable",
        consumed_resources: {},
        lifespan: 7300,
        wikipedia_link: "https://en.wikipedia.org/wiki/Wind_turbine",
        requirements: [],
        requirements_status: "satisfied",
    },
];
