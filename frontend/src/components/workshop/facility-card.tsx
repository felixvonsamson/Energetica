/**
 * A Workshop facility shown as a playing card (#998): a frame in the facility's
 * chart colour, the name and headline figures, the image, the stats as icon
 * rows, and a bottom row the caller fills (the lifetime in the catalog, the
 * lifetime left in the fleet).
 *
 * What it costs to buy is deliberately not on the card: see `FacilityPriceTag`.
 */

import {
    BatteryFull,
    Flame,
    Fuel,
    Gauge,
    type LucideIcon,
    Percent,
    Wrench,
    Zap,
} from "lucide-react";
import type { ReactNode } from "react";

import { Money } from "@/components/ui/money";
import {
    formatEnergy,
    formatGameTimeDuration,
    formatMass,
    formatPower,
} from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import {
    isStorage,
    workshopFacilityColor,
    workshopFacilityImages,
} from "@/lib/workshop-facilities";
import { roundsLabel } from "@/lib/workshop-fleet";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopFacility = ApiSchema<"WorkshopFacilityOut">;

/** Height of a card's bottom row, which an opened fleet stack lines up with. */
export const CARD_ROW_HEIGHT = 30;

/** The frame's gradient, also used by the rows an opened stack shows. */
export function cardFrame(facility: WorkshopFacility): string {
    const color = workshopFacilityColor(facility.id);
    return `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 45%, white))`;
}

export function FacilityCard({
    facility,
    footer,
    badge,
}: {
    facility: WorkshopFacility;
    /** The bottom row. Defaults to the facility's whole lifetime. */
    footer?: ReactNode;
    /** Drawn over the card's top-right corner, such as a stack's count. */
    badge?: ReactNode;
}) {
    return (
        <div
            className="relative w-60 rounded-2xl p-2 shadow-lg"
            style={{ background: cardFrame(facility) }}
        >
            <CardFace>
                <div className="flex items-start justify-between gap-2">
                    <span className="text-sm leading-tight font-extrabold">
                        {facility.name}
                    </span>
                    <HeadlineFigures facility={facility} />
                </div>
                <img
                    src={workshopFacilityImages[facility.id]}
                    alt=""
                    className="mt-1 mb-1.5 aspect-[16/10] w-full rounded-md object-cover"
                />
                <ul className="divide-y divide-stone-300 text-xs dark:divide-stone-700">
                    {facilityStats(facility).map((stat) => (
                        <li
                            key={stat.label}
                            className="flex items-center gap-2 py-1"
                        >
                            <stat.icon
                                className="size-3.5 shrink-0"
                                style={{
                                    color: workshopFacilityColor(facility.id),
                                }}
                            />
                            <span className="flex-1">{stat.label}</span>
                            <span className="font-bold">{stat.value}</span>
                        </li>
                    ))}
                </ul>
                {footer ?? (
                    <CardFooterRow
                        left="Lifetime"
                        right={
                            <>
                                <LifetimePips
                                    left={facility.lifetime_rounds}
                                    total={facility.lifetime_rounds}
                                    color={workshopFacilityColor(facility.id)}
                                />
                                {roundsLabel(facility.lifetime_rounds)}
                            </>
                        }
                    />
                )}
            </CardFace>
            {badge}
        </div>
    );
}

/** The card's light inner panel, inside the coloured frame. */
export function CardFace({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "rounded-xl bg-amber-50 p-2 text-stone-900 dark:bg-stone-900 dark:text-stone-100",
                className,
            )}
        >
            {children}
        </div>
    );
}

/** A card's bottom row: a label on the left, a figure on the right. */
export function CardFooterRow({
    left,
    right,
}: {
    left: ReactNode;
    right: ReactNode;
}) {
    return (
        <div
            className="mt-1 flex items-center justify-between border-t-2 border-stone-300 text-[11px] dark:border-stone-700"
            style={{ height: CARD_ROW_HEIGHT }}
        >
            <span className="opacity-70">{left}</span>
            <span className="flex items-center gap-1.5 font-bold">{right}</span>
        </div>
    );
}

/** One dot per Round of lifetime, filled for each Round left. */
export function LifetimePips({
    left,
    total,
    color,
}: {
    left: number;
    total: number;
    color: string;
}) {
    return (
        <span className="inline-flex gap-0.5" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
                <span
                    key={i}
                    className="size-2 rounded-full border"
                    style={{
                        borderColor: color,
                        backgroundColor: i < left ? color : "transparent",
                    }}
                />
            ))}
        </span>
    );
}

/**
 * The figures that matter most, in the top-right corner: the power for a
 * generator, and both the power and the capacity for storage, which matter
 * equally there.
 */
function HeadlineFigures({ facility }: { facility: WorkshopFacility }) {
    const power = (
        <span className="flex items-center gap-0.5">
            <Zap className="size-3 fill-yellow-400 text-yellow-500" />
            {formatPower(facility.base_power_generation)}
        </span>
    );
    if (!isStorage(facility)) {
        return (
            <span className="shrink-0 text-xs font-bold whitespace-nowrap">
                {power}
            </span>
        );
    }
    return (
        <span className="flex shrink-0 flex-col items-end text-xs leading-tight font-bold whitespace-nowrap">
            {power}
            <span className="flex items-center gap-0.5">
                <BatteryFull className="size-3" />
                {formatEnergy(facility.base_storage_capacity)}
            </span>
        </span>
    );
}

interface Stat {
    label: string;
    icon: LucideIcon;
    value: ReactNode;
}

function facilityStats(facility: WorkshopFacility): Stat[] {
    const stats: Stat[] = [];
    if (isStorage(facility)) {
        stats.push({
            label: "Efficiency",
            icon: Percent,
            value: `${Math.round(facility.base_efficiency * 100)}%`,
        });
    } else {
        stats.push({
            label: "Emissions",
            icon: Flame,
            value:
                facility.base_pollution === 0
                    ? "None"
                    : `${formatMass(facility.base_pollution)}/MWh`,
        });
    }
    stats.push({
        label: "O&M / Round",
        icon: Wrench,
        value: <Money amount={facility.om_per_round} />,
    });
    stats.push({
        label: "Ramping",
        icon: Gauge,
        value:
            facility.ramping_time === 0
                ? "Instant"
                : formatGameTimeDuration(facility.ramping_time),
    });
    if (facility.fuel_type !== null) {
        stats.push({
            label: "Fuel",
            icon: Fuel,
            value: capitalize(facility.fuel_type),
        });
    }
    return stats;
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
