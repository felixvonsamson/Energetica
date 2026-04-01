/**
 * Renewables section component - displays non-editable renewable energy
 * facilities. These appear at the bottom of the table and cannot be reordered.
 * Fetches its own data.
 */

import { Lock } from "lucide-react";
import { useMemo } from "react";

import { StatusBadge } from "@/components/power-priorities/status-badge";
import type { RenewableFacilityType } from "@/components/power-priorities/types";
import { AssetName } from "@/components/ui/asset-name";
import { CoinIcon } from "@/components/ui/coin-icon";
import { FacilityGauge } from "@/components/ui/facility-gauge";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLatestChartDataSlice } from "@/hooks/use-charts";
import { useFacilityStatuses, useFacilities } from "@/hooks/use-facilities";
import { formatPower } from "@/lib/format-utils";

interface RenewablesSectionProps {
    /** Array of renewable facility types */
    renewables: RenewableFacilityType[];
}

export function RenewablesSection({ renewables }: RenewablesSectionProps) {
    const { data: statusesData } = useFacilityStatuses();
    const { data: facilitiesData } = useFacilities();
    const { data: productionPowerLevels } = useLatestChartDataSlice({
        chartType: "power-sources",
    });

    const productionCapacityByType = useMemo(() => {
        if (!facilitiesData) return {};
        const capacities: Record<string, number> = {};
        facilitiesData.power_facilities.forEach((f) => {
            capacities[f.facility] =
                (capacities[f.facility] ?? 0) + f.max_power_generation;
        });
        facilitiesData.storage_facilities.forEach((f) => {
            capacities[f.facility] =
                (capacities[f.facility] ?? 0) + f.max_power_generation;
        });
        return capacities;
    }, [facilitiesData]);

    if (renewables.length === 0) {
        return null;
    }

    return (
        <tbody>
            {renewables.map((renewable) => {
                const status = statusesData?.renewables[renewable] ?? "available";
                const currentPowerMW = productionPowerLevels[renewable];
                const capacityMW = productionCapacityByType[renewable] ?? 0;

                return (
                    <tr key={renewable}>
                        {/* Empty left side cell */}
                        <td className="bg-transparent" />

                        {/* Facility name */}
                        <td className="py-3 px-3 font-medium bg-secondary rounded-l-lg">
                            <AssetName assetId={renewable} mode="auto" />
                        </td>

                        {/* Status badge */}
                        <td className="py-3 px-3 text-center bg-secondary">
                            <div className="inline-flex justify-center">
                                <StatusBadge
                                    status={status}
                                    variant="iconOnly"
                                />
                            </div>
                        </td>

                        {/* Power gauge (hidden on mobile) */}
                        <td className="py-3 px-3 hidden lg:table-cell bg-secondary">
                            {capacityMW > 0 ? (
                                <div className="w-30 mx-auto">
                                    <FacilityGauge
                                        facilityType={renewable}
                                        value={
                                            (currentPowerMW! / capacityMW) *
                                            100
                                        }
                                    />
                                </div>
                            ) : (
                                <div className="w-30 mx-auto text-center text-xs">—</div>
                            )}
                        </td>

                        {/* Current power */}
                        <td className="py-3 px-3 text-right text-xs bg-secondary">
                            {currentPowerMW !== undefined ? (
                                <span className="font-mono">
                                    {formatPower(currentPowerMW)}
                                </span>
                            ) : (
                                <span>—</span>
                            )}
                        </td>

                        {/* Price (-5, non-modifiable) */}
                        <td className="py-3 px-3 text-center bg-secondary">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="font-mono text-sm cursor-default inline-flex items-center gap-1">
                                        -5.00
                                        <span className="text-muted-foreground text-xs inline-flex items-center gap-0.5">
                                            <CoinIcon className="size-3" />/MWh
                                        </span>
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    Renewables are not controllable and their
                                    price is set to the cost of dumping
                                </TooltipContent>
                            </Tooltip>
                        </td>

                        {/* Lock icon with tooltip */}
                        <td className="py-3 px-3 text-center bg-secondary rounded-r-lg">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Lock className="w-4 h-4 shrink-0 inline-block cursor-default" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    Renewables are not controllable. They are
                                    always active.
                                </TooltipContent>
                            </Tooltip>
                        </td>
                    </tr>
                );
            })}
        </tbody>
    );
}
