/**
 * The table under a Trading-period review chart: each series' energy over the
 * day, with a button to hide or show it in the chart. A lighter take on the
 * persistent world's power and market tables.
 */

import type { ReactNode } from "react";

import { MagnitudeBar } from "@/components/ui/magnitude-bar";
import { formatEnergy } from "@/lib/format-utils";
import { type ChartRow, seriesEnergy } from "@/lib/workshop-review";

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
}: PeriodSeriesTableProps) {
    if (keys.length === 0) return null;
    const energies = keys.map((key) => seriesEnergy(rows, key, hoursPerPoint));
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
                        <th className="py-2 px-4 text-left font-semibold">
                            {energyHeading} over the day
                        </th>
                        <th className="py-2 px-4" />
                    </tr>
                </thead>
                <tbody>
                    {sorted.map(({ key, energy }) => {
                        const visible = !hidden.has(key);
                        return (
                            <tr key={key} className="border-b border-border/30">
                                <td className="py-2 px-4">{label(key)}</td>
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
