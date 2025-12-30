/**
 * Renewables section component - displays non-editable renewable energy
 * facilities. These appear at the bottom of the consumption table and cannot be
 * reordered. Uses the same visual style as production items.
 */

import { Lock } from "lucide-react";

import { StatusBadge } from "./StatusBadge";
import type { RenewableFacilityType } from "./types";

import { AssetName } from "@/components/ui/AssetName";
import { FacilityGauge } from "@/components/ui/FacilityGauge";
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
 * Displays renewable facilities with a lock icon to indicate they're always
 * active and cannot be reordered. Renewables have priority over all other
 * facilities. Styled to match production items.
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
        <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 ml-18">
                Renewables (always active)
            </h3>
            <div className="space-y-2">
                {renewables.map((renewable, idx) => {
                    // Look up status for this renewable, default to "available"
                    const status =
                        statuses.renewables[renewable] || "available";
                    const currentPowerMW = productionPowerLevels[renewable];
                    const capacityMW = productionCapacityByType[renewable] || 0;

                    return (
                        <div
                            key={`renewable-${idx}`}
                            className="grid grid-cols-[1fr_80px_160px_130px_60px] gap-3 items-center p-3 bg-tan-green dark:bg-dark-bg-secondary rounded-lg ml-18"
                        >
                            {/* Facility name */}
                            <div className="min-w-0 font-medium flex items-center gap-2">
                                <AssetName assetId={renewable} mode="auto" />
                            </div>

                            {/* Current power */}
                            <div className="text-xs text-gray-600 dark:text-gray-400 text-right">
                                {currentPowerMW !== undefined ? (
                                    <span className="font-mono">
                                        {formatPower(currentPowerMW)}
                                    </span>
                                ) : (
                                    <span>—</span>
                                )}
                            </div>

                            {/* Power gauge */}
                            <div>
                                {capacityMW > 0 ? (
                                    <FacilityGauge
                                        facilityType={renewable}
                                        value={
                                            capacityMW > 0
                                                ? (currentPowerMW! /
                                                      capacityMW) *
                                                  100
                                                : 0
                                        }
                                    />
                                ) : (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        —
                                    </div>
                                )}
                            </div>

                            {/* Status badge */}
                            <div className="flex justify-end">
                                <StatusBadge status={status} />
                            </div>

                            {/* Lock icon instead of priority number */}
                            <div className="flex justify-center">
                                <Lock className="w-4 h-4 shrink-0" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
