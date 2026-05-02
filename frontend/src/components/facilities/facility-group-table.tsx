/**
 * Generic facility table component with grouping, expand/collapse, and bulk
 * actions. Used for displaying power, storage, and extraction facilities.
 */

import { useState, ReactNode, Fragment } from "react";

import {
    Money,
    CashFlow,
    FacilityName,
    InfoBanner,
    Duration,
} from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
    useUpgradeFacility,
    useUpgradeAllOfType,
    useDismantleFacility,
    useDismantleAllOfType,
} from "@/hooks/use-facilities";

interface FacilityBase {
    id: number;
    facility: string;
    op_cost_per_tick: number;
    remaining_lifespan: number | null;
    upgrade_cost: number | null;
    dismantle_cost: number | null;
}

interface Column<T> {
    header: string;
    className?: string;
    sortable?: boolean;
    sortKey?: keyof T;
    render: (facility: T) => ReactNode;
    renderSummary: (facilities: T[]) => ReactNode;
}

interface FacilityGroupTableProps<T extends FacilityBase> {
    facilities: T[];
    columns: Column<T>[];
    emptyMessage?: string;
}

type SortConfig<T> = {
    key: keyof T | "facility" | "op_cost_per_tick" | "remaining_lifespan";
    direction: "asc" | "desc";
} | null;

/** Renders the confirmation dialog content with count and cost info */
function ConfirmationContent({
    facilityName,
    count,
    totalCost,
    isDismantling,
}: {
    facilityName: string;
    count: number;
    totalCost: number;
    isDismantling: boolean;
}) {
    return (
        <div className="space-y-3">
            <p>
                Are you sure you want to{" "}
                {isDismantling ? "dismantle" : "upgrade"} all{" "}
                <FacilityName facility={facilityName} as="strong" mode="long" />{" "}
                facilities?
            </p>
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                    <span className="font-semibold">Number of facilities:</span>
                    <span>{count}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-semibold">Total cost:</span>
                    <Money amount={totalCost} />
                </div>
            </div>
            {isDismantling && (
                <InfoBanner variant="warning">
                    This action cannot be undone!
                </InfoBanner>
            )}
        </div>
    );
}

/** Renders action buttons for a single facility row */
function FacilityActions({
    facility,
    upgradeMutation,
    dismantleMutation,
}: {
    facility: FacilityBase;
    upgradeMutation: ReturnType<typeof useUpgradeFacility>;
    dismantleMutation: ReturnType<typeof useDismantleFacility>;
}) {
    return (
        <>
            <td className="py-3 px-4 text-center">
                {facility.upgrade_cost !== null ? (
                    <button
                        onClick={() => upgradeMutation.mutate(facility.id)}
                        disabled={upgradeMutation.isPending}
                        className="bg-brand hover:bg-brand/80 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                    >
                        <Money amount={facility.upgrade_cost} />
                    </button>
                ) : (
                    <span className="text-gray-400">-</span>
                )}
            </td>
            <td className="py-3 px-4 text-center">
                {facility.dismantle_cost !== null ? (
                    <button
                        onClick={() => dismantleMutation.mutate(facility.id)}
                        disabled={dismantleMutation.isPending}
                        className="bg-destructive hover:bg-destructive/80 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                    >
                        <Money amount={facility.dismantle_cost} />
                    </button>
                ) : (
                    <span className="text-gray-400">-</span>
                )}
            </td>
        </>
    );
}

/** Renders bulk action buttons for a facility group */
function GroupActions({
    facilityName,
    count,
    hasUpgrades,
    totalUpgradeCost,
    totalDismantleCost,
    upgradeAllMutation,
    dismantleAllMutation,
}: {
    facilityName: string;
    count: number;
    hasUpgrades: boolean;
    totalUpgradeCost: number;
    totalDismantleCost: number;
    upgradeAllMutation: ReturnType<typeof useUpgradeAllOfType>;
    dismantleAllMutation: ReturnType<typeof useDismantleAllOfType>;
}) {
    return (
        <>
            <td
                className="py-3 px-4 text-center"
                onClick={(e) => e.stopPropagation()}
            >
                {hasUpgrades ? (
                    <ConfirmDialog
                        trigger={
                            <button
                                disabled={upgradeAllMutation.isPending}
                                className="bg-brand hover:bg-brand/80 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                            >
                                Upgrade All
                            </button>
                        }
                        title="Confirm Upgrade All"
                        description={
                            <ConfirmationContent
                                facilityName={facilityName}
                                count={count}
                                totalCost={totalUpgradeCost}
                                isDismantling={false}
                            />
                        }
                        confirmLabel="Upgrade All"
                        onConfirm={() =>
                            upgradeAllMutation.mutate(facilityName)
                        }
                        isPending={upgradeAllMutation.isPending}
                    />
                ) : (
                    <span className="text-gray-400">-</span>
                )}
            </td>
            <td
                className="py-3 px-4 text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <ConfirmDialog
                    trigger={
                        <button
                            disabled={dismantleAllMutation.isPending}
                            className="bg-destructive hover:bg-destructive/80 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                        >
                            Dismantle All
                        </button>
                    }
                    title="Confirm Dismantle All"
                    description={
                        <ConfirmationContent
                            facilityName={facilityName}
                            count={count}
                            totalCost={totalDismantleCost}
                            isDismantling={true}
                        />
                    }
                    confirmLabel="Dismantle All"
                    variant="danger"
                    onConfirm={() => dismantleAllMutation.mutate(facilityName)}
                    isPending={dismantleAllMutation.isPending}
                />
            </td>
        </>
    );
}

/**
 * Generic grouped facility table with expand/collapse, sorting, and bulk
 * operations.
 */
export function FacilityGroupTable<T extends FacilityBase>({
    facilities,
    columns,
    emptyMessage = "No facilities built yet",
}: FacilityGroupTableProps<T>) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        new Set(),
    );
    const [sortConfig, setSortConfig] = useState<SortConfig<T>>(null);

    const upgradeMutation = useUpgradeFacility();
    const upgradeAllMutation = useUpgradeAllOfType();
    const dismantleMutation = useDismantleFacility();
    const dismantleAllMutation = useDismantleAllOfType();

    if (facilities.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">{emptyMessage}</div>
        );
    }

    // Group facilities by type first
    const groupedFacilities = facilities.reduce(
        (acc, facility) => {
            const name = facility.facility;
            if (!acc[name]) {
                acc[name] = [];
            }
            acc[name].push(facility);
            return acc;
        },
        {} as Record<string, T[]>,
    );

    // Sort facilities within each group
    const sortFacilities = (facilitiesList: T[]) => {
        return [...facilitiesList].sort((a, b) => {
            if (!sortConfig) return 0;

            const aVal = a[sortConfig.key as keyof T];
            const bVal = b[sortConfig.key as keyof T];

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            const compareResult = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;

            return sortConfig.direction === "asc"
                ? compareResult
                : -compareResult;
        });
    };

    // Sort the group entries based on aggregated values
    const sortedGroupEntries = Object.entries(groupedFacilities)
        .map(
            ([name, facilitiesList]) =>
                [name, sortFacilities(facilitiesList)] as [string, T[]],
        )
        .sort(([nameA, facilitiesA], [nameB, facilitiesB]) => {
            if (!sortConfig) return 0;

            let aVal: string | number;
            let bVal: string | number;

            if (sortConfig.key === "facility") {
                // Sort by facility name
                aVal = nameA;
                bVal = nameB;
            } else if (sortConfig.key === "op_cost_per_tick") {
                // Sort by total O&M cost
                aVal = facilitiesA.reduce(
                    (sum, f) => sum + f.op_cost_per_tick,
                    0,
                );
                bVal = facilitiesB.reduce(
                    (sum, f) => sum + f.op_cost_per_tick,
                    0,
                );
            } else if (sortConfig.key === "remaining_lifespan") {
                // Sort by average lifespan
                const avgA =
                    facilitiesA.reduce(
                        (sum, f) => sum + (f.remaining_lifespan || Infinity),
                        0,
                    ) / facilitiesA.length;
                const avgB =
                    facilitiesB.reduce(
                        (sum, f) => sum + (f.remaining_lifespan || Infinity),
                        0,
                    ) / facilitiesB.length;
                aVal = avgA;
                bVal = avgB;
            } else {
                // Sort by sum of column values
                aVal = facilitiesA.reduce(
                    (sum, f) =>
                        sum + ((f[sortConfig.key] as number | undefined) || 0),
                    0,
                );
                bVal = facilitiesB.reduce(
                    (sum, f) =>
                        sum + ((f[sortConfig.key] as number | undefined) || 0),
                    0,
                );
            }

            const compareResult = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;

            return sortConfig.direction === "asc"
                ? compareResult
                : -compareResult;
        });

    const toggleGroup = (name: string) => {
        setExpandedGroups((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(name)) {
                newSet.delete(name);
            } else {
                newSet.add(name);
            }
            return newSet;
        });
    };

    const handleSort = (
        key: keyof T | "facility" | "op_cost_per_tick" | "remaining_lifespan",
    ) => {
        setSortConfig((current) => {
            if (current?.key === key) {
                // Toggle direction or clear
                if (current.direction === "desc") {
                    return { key, direction: "asc" };
                }
                return null; // Clear sort
            }
            return { key, direction: "desc" };
        });
    };

    const getSortIndicator = (key: keyof T | string) => {
        if (sortConfig?.key !== key) return null;
        return sortConfig.direction === "asc" ? " ▲" : " ▼";
    };

    return (
        <table className="w-full text-sm">
            <thead>
                <tr className="bg-secondary">
                    <th
                        className="py-3 px-4 text-left font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                        onClick={() => handleSort("facility")}
                    >
                        Name{getSortIndicator("facility")}
                    </th>
                    {columns.map((col) => (
                        <th
                            key={col.header}
                            className={`py-3 px-4 font-semibold ${col.className || ""} ${
                                col.sortable
                                    ? "cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                                    : ""
                            }`}
                            onClick={
                                col.sortable && col.sortKey
                                    ? () => handleSort(col.sortKey!)
                                    : undefined
                            }
                        >
                            {col.header}
                            {col.sortable &&
                                col.sortKey &&
                                getSortIndicator(col.sortKey)}
                        </th>
                    ))}
                    <th
                        className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                        onClick={() => handleSort("op_cost_per_tick")}
                    >
                        O&M Cost{getSortIndicator("op_cost_per_tick")}
                    </th>
                    <th
                        className="py-3 px-4 text-right font-semibold cursor-pointer hover:bg-tan-green/80 dark:hover:bg-card transition-colors"
                        onClick={() => handleSort("remaining_lifespan")}
                    >
                        Lifespan{getSortIndicator("remaining_lifespan")}
                    </th>
                    <th className="py-3 px-4 text-center font-semibold">
                        Upgrade
                    </th>
                    <th className="py-3 px-4 text-center font-semibold">
                        Dismantle
                    </th>
                </tr>
            </thead>
            <tbody>
                {sortedGroupEntries.map(([facilityName, facilityGroup]) => {
                    const isExpanded = expandedGroups.has(facilityName);
                    const count = facilityGroup.length;

                    // Calculate summary values
                    const totalOpCost = facilityGroup.reduce(
                        (sum, f) => sum + f.op_cost_per_tick,
                        0,
                    );
                    const avgLifespan =
                        facilityGroup.reduce(
                            (sum, f) => sum + (f.remaining_lifespan || 0),
                            0,
                        ) / count;
                    const hasInfiniteLifespan = facilityGroup.some(
                        (f) => f.remaining_lifespan === null,
                    );
                    const hasUpgrades = facilityGroup.some(
                        (f) => f.upgrade_cost !== null,
                    );
                    const totalUpgradeCost = facilityGroup.reduce(
                        (sum, f) => sum + (f.upgrade_cost || 0),
                        0,
                    );
                    const totalDismantleCost = facilityGroup.reduce(
                        (sum, f) => sum + (f.dismantle_cost || 0),
                        0,
                    );

                    return (
                        <Fragment key={facilityName}>
                            {/* Summary Row */}
                            <tr
                                key={facilityName}
                                className="border-b-2 border-border/50 bg-muted/50 font-semibold cursor-pointer hover:bg-tan-green/30 dark:hover:bg-muted/70 transition-colors"
                                onClick={() => toggleGroup(facilityName)}
                            >
                                <td className="py-3 px-4">
                                    <span className="inline-block w-4 mr-2 text-center">
                                        {isExpanded ? "▼" : "▶"}
                                    </span>
                                    <FacilityName
                                        facility={facilityName}
                                        mode="long"
                                    />{" "}
                                    ({count})
                                </td>
                                {columns.map((col) => (
                                    <td
                                        key={col.header}
                                        className={`py-3 px-4 ${col.className || ""}`}
                                    >
                                        {col.renderSummary(facilityGroup)}
                                    </td>
                                ))}
                                <td className="py-3 px-4 text-right">
                                    <CashFlow amountPerTick={totalOpCost} />
                                </td>
                                <td className="py-3 px-4 text-right font-mono">
                                    {hasInfiniteLifespan ? (
                                        "∞"
                                    ) : (
                                        <Duration
                                            ticks={avgLifespan}
                                            compact
                                        />
                                    )}
                                </td>
                                <GroupActions
                                    facilityName={facilityName}
                                    count={count}
                                    hasUpgrades={hasUpgrades}
                                    totalUpgradeCost={totalUpgradeCost}
                                    totalDismantleCost={totalDismantleCost}
                                    upgradeAllMutation={upgradeAllMutation}
                                    dismantleAllMutation={dismantleAllMutation}
                                />
                            </tr>

                            {/* Detail Rows */}
                            {isExpanded &&
                                facilityGroup.map((facility) => (
                                    <tr
                                        key={facility.id}
                                        className="border-b border-border/30 hover:bg-tan-green/20 dark:hover:bg-muted/30 transition-colors"
                                    >
                                        <td className="py-3 px-4 pl-12 opacity-0">
                                            {facility.facility}
                                        </td>
                                        {columns.map((col) => (
                                            <td
                                                key={col.header}
                                                className={`py-3 px-4 ${col.className || ""}`}
                                            >
                                                {col.render(facility)}
                                            </td>
                                        ))}
                                        <td className="py-3 px-4 text-right">
                                            <CashFlow
                                                amountPerTick={facility.op_cost_per_tick}
                                            />
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono">
                                            {facility.remaining_lifespan ? (
                                                <Duration
                                                    ticks={
                                                        facility.remaining_lifespan
                                                    }
                                                    compact
                                                />
                                            ) : (
                                                "∞"
                                            )}
                                        </td>
                                        <FacilityActions
                                            facility={facility}
                                            upgradeMutation={upgradeMutation}
                                            dismantleMutation={
                                                dismantleMutation
                                            }
                                        />
                                    </tr>
                                ))}
                        </Fragment>
                    );
                })}
            </tbody>
        </table>
    );
}
