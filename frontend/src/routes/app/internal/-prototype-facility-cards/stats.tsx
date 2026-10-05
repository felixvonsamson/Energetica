/**
 * PROTOTYPE — the stats each card shows, shared by every variant so they only
 * disagree about presentation. Price, construction lag and construction
 * pollution are deliberately not here: they sit outside the card (#998).
 */

import {
    BatteryCharging,
    Flame,
    Gauge,
    type LucideIcon,
    Percent,
    Wrench,
    Zap,
} from "lucide-react";

import { formatEnergy, formatMoney, formatPower } from "@/lib/format-utils";

import { type Facility, formatRamping, FUEL_COLOR, isStorage } from "./mock";

export interface Stat {
    key: string;
    label: string;
    icon: LucideIcon;
    value: string;
    /** 0–1, how strong this stat is against the whole catalog. For stat bars. */
    strength: number;
    color?: string;
}

const catalogMax = (pick: (f: Facility) => number, catalog: Facility[]) =>
    Math.max(...catalog.map(pick), 1);

/** Log scale so a 11 MW turbine still shows a visible bar next to 335 MW. */
const logShare = (value: number, max: number) =>
    value <= 0
        ? 0
        : Math.max(0.06, Math.log10(1 + value) / Math.log10(1 + max));

export function cardStats(f: Facility, catalog: Facility[]): Stat[] {
    const stats: Stat[] = [];
    if (isStorage(f)) {
        stats.push({
            key: "capacity",
            label: "Capacity",
            icon: BatteryCharging,
            value: formatEnergy(f.base_storage_capacity ?? 0),
            strength: logShare(
                f.base_storage_capacity ?? 0,
                catalogMax((c) => c.base_storage_capacity ?? 0, catalog),
            ),
        });
        stats.push({
            key: "power",
            label: "Power",
            icon: Zap,
            value: formatPower(f.base_power_generation),
            strength: logShare(
                f.base_power_generation,
                catalogMax((c) => c.base_power_generation, catalog),
            ),
        });
        stats.push({
            key: "efficiency",
            label: "Efficiency",
            icon: Percent,
            value: `${Math.round((f.base_efficiency ?? 0) * 100)}%`,
            strength: f.base_efficiency ?? 0,
        });
    } else {
        stats.push({
            key: "power",
            label: "Max power",
            icon: Zap,
            value: formatPower(f.base_power_generation),
            strength: logShare(
                f.base_power_generation,
                catalogMax((c) => c.base_power_generation, catalog),
            ),
        });
        stats.push({
            key: "emissions",
            label: "Emissions",
            icon: Flame,
            value:
                f.base_pollution === 0
                    ? "None"
                    : `${f.base_pollution.toLocaleString("en-US").replace(/,/g, "'")} kg/MWh`,
            strength:
                f.base_pollution / catalogMax((c) => c.base_pollution, catalog),
            color: "var(--color-destructive, rgb(220, 38, 38))",
        });
    }
    stats.push({
        key: "om",
        label: "O&M / Round",
        icon: Wrench,
        value: formatMoney(f.om_per_round),
        strength: logShare(
            f.om_per_round,
            catalogMax((c) => c.om_per_round, catalog),
        ),
        color: "rgb(217, 119, 6)",
    });
    stats.push({
        key: "ramping",
        label: "Ramping",
        icon: Gauge,
        value: formatRamping(f.ramping_time),
        // Faster is stronger.
        strength:
            1 - f.ramping_time / catalogMax((c) => c.ramping_time, catalog),
    });
    if (f.fuel_type) {
        stats.push({
            key: "fuel",
            label: "Fuel",
            icon: Flame,
            value: f.fuel_type[0]!.toUpperCase() + f.fuel_type.slice(1),
            strength: 1,
            color: FUEL_COLOR[f.fuel_type],
        });
    }
    return stats;
}

/** Filled and empty pips for a lifetime, e.g. 2 of 4 Rounds left. */
export function LifetimePips({
    remaining,
    total,
    color,
    className,
}: {
    remaining: number;
    total: number;
    color: string;
    className?: string;
}) {
    return (
        <span className={`inline-flex gap-0.5 ${className ?? ""}`}>
            {Array.from({ length: total }, (_, i) => (
                <span
                    key={i}
                    className="size-2 rounded-full border"
                    style={{
                        borderColor: color,
                        backgroundColor: i < remaining ? color : "transparent",
                    }}
                />
            ))}
        </span>
    );
}

export function roundsLabel(n: number): string {
    return `${n} ${n === 1 ? "Round" : "Rounds"}`;
}
