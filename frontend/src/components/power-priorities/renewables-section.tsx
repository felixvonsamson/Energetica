/**
 * Renewables section component - displays non-editable renewable energy
 * facilities. These appear at the bottom of the consumption table and cannot be
 * reordered. Uses the same visual style as production items.
 */

import { Lock } from "lucide-react";

import { StatusBadge } from "@/components/power-priorities/status-badge";
import type { RenewableFacilityType } from "@/components/power-priorities/types";
import { Money } from "@/components/ui";
import { AssetName } from "@/components/ui/asset-name";
import { FacilityGauge } from "@/components/ui/facility-gauge";
import { formatPower } from "@/lib/format-utils";
import type { ApiResponse } from "@/types/api-helpers";

interface RenewablesSectionProps {
    /** Array of renewable facility types */
    renewables: RenewableFacilityType[];
    /** Facility statuses from the API */
    statuses: ApiResponse<"/api/v1/facilities/statuses", "get">;
    /** Production power levels by facility type */
    productionPowerLevels?: Record<string, number>;
    /** Production capacity by facility type */
    productionCapacityByType?: Record<string, number>;
}

/**
 * Displays renewable facilities as table rows with a lock icon to indicate
 * they're always active and cannot be reordered. Renewables have priority over
 * all other facilities. Styled to match production items.
 */
export function RenewablesSection({
    renewables,
    statuses,
    productionPowerLevels = {},
    productionCapacityByType = {},
}: RenewablesSectionProps) {
    if (renewables.length === 0) {
        return null;
    }

    return (
        <tbody>
            <tr>
                <td
                    colSpan={7}
                    className="pt-4 pb-2 px-3 border-t-2 border-gray-300 dark:border-gray-600"
                >
                    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                        Renewables (always active)
                    </h3>
                </td>
            </tr>
            {renewables.map((renewable) => {
                // Look up status for this renewable, default to "available"
                const status = statuses.renewables[renewable] || "available";
                const currentPowerMW = productionPowerLevels[renewable];
                const capacityMW = productionCapacityByType[renewable] || 0;

                return (
                    <tr key={renewable}>
                        {/* Empty consumption priority column */}
                        <td className="bg-transparent" />

                        {/* Facility name */}
                        <td className="py-3 px-3 font-medium bg-secondary rounded-l-lg">
                            <AssetName assetId={renewable} mode="auto" />
                        </td>

                        {/* Current power */}
                        <td className="py-3 px-3 text-right text-xs text-gray-600 dark:text-gray-400 bg-secondary">
                            {currentPowerMW !== undefined ? (
                                <span className="font-mono">
                                    {formatPower(currentPowerMW)}
                                </span>
                            ) : (
                                <span>—</span>
                            )}
                        </td>

                        {/* Power gauge (hidden on mobile) */}
                        <td className="py-3 px-3 hidden lg:table-cell bg-secondary">
                            {capacityMW > 0 ? (
                                <FacilityGauge
                                    facilityType={renewable}
                                    value={
                                        capacityMW > 0
                                            ? (currentPowerMW! / capacityMW) *
                                              100
                                            : 0
                                    }
                                />
                            ) : (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    —
                                </div>
                            )}
                        </td>

                        {/* Price */}
                        <td className="py-3 px-3 text-right bg-secondary">
                            <Money amount={null} />
                        </td>

                        {/* Status badge */}
                        <td className="py-3 px-3 text-right bg-secondary">
                            <div className="inline-flex justify-end">
                                <StatusBadge
                                    status={status}
                                    variant="iconOnly"
                                />
                            </div>
                        </td>

                        {/* Lock icon instead of priority number */}
                        <td className="py-3 px-3 text-center bg-secondary rounded-r-lg">
                            <Lock className="w-4 h-4 shrink-0 inline-block" />
                        </td>
                    </tr>
                );
            })}
        </tbody>
    );
}
