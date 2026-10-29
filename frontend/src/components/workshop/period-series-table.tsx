/**
 * The table under a Trading-period review chart: each series' energy over the
 * day, with a button to hide or show it in the chart. A player's generation
 * also shows each facility type's capacity factor. A lighter take on the
 * persistent world's power and market tables.
 */

import type { ReactNode } from "react";

import { MagnitudeBar } from "@/components/ui/magnitude-bar";
import { InfoMark, MetricTooltip } from "@/components/workshop/metric-tooltip";
import { type ChartRow, seriesEnergy } from "@/lib/workshop-review";
import { formatEnergy } from "@energetica/core/format-utils";
import { FacilityGauge } from "@energetica/ui/components/facility-gauge";

interface PeriodSeriesTableProps {
    rows: ChartRow[];
    /** The series in the chart's stack order. */
    keys: string[];
    hoursPerPoint: number;
    hidden: Set<string>;
    onToggle: (key: string) => void;
    label: (key: string) => ReactNode;
    color: (key: string) => string;
    /** The energy column's heading, such as "Generated". */
    energyHeading: string;
    /** What the energy is summed over. "the day" by default. */
    span?: string;
    /**
     * Called with a row's series key when the player hovers the row, and with
     * null when the pointer leaves the table.
     */
    onHoverRow?: (key: string | null) => void;
    /**
     * The most a series' facilities could generate, in W. When given, a
     * capacity factor column shows each series' average output over it, so only
     * pass it for series keyed by facility type.
     */
    power?: (key: string) => number | undefined;
}

export function PeriodSeriesTable({
    rows,
    keys,
    hoursPerPoint,
    hidden,
    onToggle,
    label,
    color,
    energyHeading,
    span = "the day",
    onHoverRow,
    power,
}: PeriodSeriesTableProps) {
    if (keys.length === 0) return null;
    const energies = keys.map((key) => seriesEnergy(rows, key, hoursPerPoint));
    const hours = rows.length * hoursPerPoint;
    /** The series' average output as a percentage of its power. */
    const capacityFactor = (key: string, energy: number) => {
        const watts = power?.(key);
        return watts && hours > 0 ? (energy / hours / watts) * 100 : undefined;
    };
    const max = Math.max(...energies);
    const sorted = keys
        .map((key, i) => ({ key, energy: energies[i] ?? 0 }))
        .sort((a, b) => b.energy - a.energy);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-secondary">
                        <th className="py-2 px-4 text-left font-semibold">
                            Series
                        </th>
                        {power && (
                            <th className="py-2 px-4 text-center font-semibold">
                                <MetricTooltip
                                    content={`Average output over ${span}, as a share of the most the facilities could generate.`}
                                >
                                    <span className="inline-flex items-center gap-1 cursor-help">
                                        Capacity factor
                                        <InfoMark />
                                    </span>
                                </MetricTooltip>
                            </th>
                        )}
                        <th className="py-2 px-4 text-left font-semibold">
                            {energyHeading} over {span}
                        </th>
                        <th className="py-2 px-4" />
                    </tr>
                </thead>
                <tbody onMouseLeave={() => onHoverRow?.(null)}>
                    {sorted.map(({ key, energy }) => {
                        const visible = !hidden.has(key);
                        const factor = capacityFactor(key, energy);
                        return (
                            <tr
                                key={key}
                                onMouseEnter={() => onHoverRow?.(key)}
                                className="border-b border-border/30"
                            >
                                <td className="py-2 px-4">{label(key)}</td>
                                {power && (
                                    <td
                                        className={`py-2 px-4 min-w-37.5 text-center transition-opacity ${visible ? "" : "opacity-40"}`}
                                    >
                                        {factor !== undefined ? (
                                            <FacilityGauge
                                                facilityType={key}
                                                value={Math.min(factor, 100)}
                                            />
                                        ) : (
                                            "-"
                                        )}
                                    </td>
                                )}
                                <td className="py-2 px-4">
                                    <MagnitudeBar
                                        value={energy}
                                        max={max}
                                        color={color(key)}
                                        label={formatEnergy(energy)}
                                        dimmed={!visible}
                                    />
                                </td>
                                <td className="py-2 px-4 text-center">
                                    <button
                                        onClick={() => onToggle(key)}
                                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                            visible
                                                ? "bg-brand hover:bg-brand/80 text-white"
                                                : "bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300"
                                        }`}
                                    >
                                        {visible ? "Hide" : "Show"}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
