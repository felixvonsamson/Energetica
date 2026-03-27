/**
 * Renewables section component - displays non-editable renewable energy
 * facilities. These appear at the bottom of the table and cannot be reordered.
 * Fetches its own data.
 */

import { Lock } from "lucide-react";
import { useMemo } from "react";

import { StatusBadge } from "@/components/power-priorities/status-badge";
import type { RenewableFacilityType } from "@/components/power-priorities/types";
import { Money } from "@/components/ui";
import { AssetName } from "@/components/ui/asset-name";
import { FacilityGauge } from "@/components/ui/facility-gauge";
import {
    TypographyH3,
    TypographyMuted,
    TypographySmall,
} from "@/components/ui/typography";
import { useLatestChartDataSlice } from "@/hooks/use-charts";
import { useFacilityStatuses, useFacilities } from "@/hooks/use-facilities";
import { formatPower } from "@/lib/format-utils";

interface RenewablesSectionProps {
    /** Array of renewable facility types */
    renewables: RenewableFacilityType[];
}

/**
 * Displays renewable facilities as table rows with a lock icon to indicate
 * they're always active and cannot be reordered. Renewables have priority over
 * all other facilities. Styled to match production items.
 */
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
            <tr>
                <td
                    colSpan={7}
                    className="pt-4 pb-2 px-3 border-t-2 border-border"
                >
                    <TypographyH3>
                        <TypographyMuted>
                            <TypographySmall>
                                Renewables (always active)
                            </TypographySmall>
                        </TypographyMuted>
                    </TypographyH3>
                </td>
            </tr>
            {renewables.map((renewable) => {
                const status = statusesData?.renewables[renewable] ?? "available";
                const currentPowerMW = productionPowerLevels[renewable];
                const capacityMW = productionCapacityByType[renewable] ?? 0;

                return (
                    <tr key={renewable}>
                        {/* Empty consumption priority column */}
                        <td className="bg-transparent" />

                        {/* Facility name */}
                        <td className="py-3 px-3 font-medium bg-secondary rounded-l-lg">
                            <AssetName assetId={renewable} mode="auto" />
                        </td>

                        {/* Current power */}
                        <td className="py-3 px-3 text-right text-xs text-muted-foreground bg-secondary">
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
                                <div className="text-xs text-muted-foreground">
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
