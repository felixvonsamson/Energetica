/**
 * Component for displaying resource stock and potential indicators for power
 * facilities. Shows wind/solar/hydro potential and resource stock information.
 */

import { Info, AlertTriangle } from "lucide-react";

import { formatMass } from "@/lib/format-utils";

interface ResourceStockIndicatorsProps {
    facilityName: string;
    windPotential?: number | null;
    solarPotential?: number | null;
    hydroPotential?: number | null;
    highHydroCost?: boolean | null;
    lowWindSpeed?: boolean | null;
    playerResources?: {
        coal?: number;
        gas?: number;
        uranium?: number;
    };
}

export function ResourceStockIndicators({
    facilityName,
    windPotential,
    solarPotential,
    hydroPotential,
    highHydroCost,
    lowWindSpeed,
    playerResources,
}: ResourceStockIndicatorsProps) {
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

    const isWindFacility = windFacilities.includes(facilityName);
    const isSolarFacility = solarFacilities.includes(facilityName);
    const isHydroFacility = hydroFacilities.includes(facilityName);

    return (
        <div className="mt-2">
            {/* Wind Potential */}
            {isWindFacility &&
                windPotential !== undefined &&
                windPotential !== null && (
                    <div className="text-blue-600 dark:text-blue-400 italic flex items-center gap-1">
                        <Info className="w-4 h-4 flex-shrink-0" />
                        <span>
                            Wind potential:{" "}
                            <strong>{Math.round(windPotential * 100)}%</strong>
                        </span>
                    </div>
                )}

            {/* Solar Potential */}
            {isSolarFacility &&
                solarPotential !== undefined &&
                solarPotential !== null && (
                    <div className="text-blue-600 dark:text-blue-400 italic flex items-center gap-1">
                        <Info className="w-4 h-4 flex-shrink-0" />
                        <span>
                            Solar potential:{" "}
                            <strong>{Math.round(solarPotential * 100)}%</strong>
                        </span>
                    </div>
                )}

            {/* Hydro Potential */}
            {isHydroFacility &&
                hydroPotential !== undefined &&
                hydroPotential !== null && (
                    <div className="text-blue-600 dark:text-blue-400 italic flex items-center gap-1">
                        <Info className="w-4 h-4 flex-shrink-0" />
                        <span>
                            Hydro potential:{" "}
                            <strong>{Math.round(hydroPotential * 100)}%</strong>
                        </span>
                    </div>
                )}

            {/* High Hydro Cost Warning */}
            {highHydroCost && (
                <div className="text-amber-600 dark:text-amber-400 italic flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>
                        High construction cost due to limited hydro potential
                    </span>
                </div>
            )}

            {/* Low Wind Speed Warning */}
            {lowWindSpeed && (
                <div className="text-amber-600 dark:text-amber-400 italic flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>
                        Low wind speed in this location may reduce efficiency
                    </span>
                </div>
            )}

            {/* Resource Stock */}
            {playerResources &&
                Object.entries(resourceFacilities).map(
                    ([resource, facilities]) => {
                        if (facilities.includes(facilityName)) {
                            const stock =
                                playerResources[
                                    resource as keyof typeof playerResources
                                ];
                            if (stock === undefined) return null;
                            return (
                                <div
                                    key={resource}
                                    className="text-blue-600 dark:text-blue-400 italic flex items-center gap-1"
                                >
                                    <Info className="w-4 h-4 flex-shrink-0" />
                                    <span>
                                        Current stock of {resource}:{" "}
                                        <strong>{formatMass(stock)}</strong>
                                    </span>
                                </div>
                            );
                        }
                        return null;
                    },
                )}
        </div>
    );
}
