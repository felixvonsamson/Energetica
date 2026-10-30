/**
 * A Workshop facility shown as a playing card (#998): a frame in the facility's
 * chart colour, the name and headline figures, the image, the stats as icon
 * rows, and a bottom row the caller fills (the lifetime in the catalog, the
 * lifetime left in the fleet).
 *
 * Hovering a stat marked with an info mark shows figures worked out from it
 * (#1400): the O&M split into a fixed cost per season and a variable cost per
 * MWh, the fuel burned with its cost per MWh at this season's price, the
 * expected generation of each season, the carbon tax per MWh once one is in
 * force, and so on. Players add up the costs per MWh themselves to find their
 * marginal cost, so the card never shows it.
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

import {
    InfoMark,
    MetricTooltip,
    MoneyPerMWh,
    StorageMarkupNote,
    TooltipFigure,
} from "@/components/workshop/metric-tooltip";
import {
    useWorkshopFuel,
    useWorkshopSession,
    useWorkshopVote,
} from "@/hooks/use-workshop";
import { formatVolume } from "@/lib/workshop-balance-sheet";
import { taxPerTonne } from "@/lib/workshop-control-room";
import {
    formatFuelUse,
    isStorage,
    workshopFacilityColor,
    workshopFacilityImages,
} from "@/lib/workshop-facilities";
import { roundsLabel } from "@/lib/workshop-fleet";
import {
    carbonTaxPerMWh,
    fuelCostPerMWh,
    maxFuelPerSeason,
    nextBuyRound,
    workingRounds,
} from "@/lib/workshop-metrics";
import { SEASON_LABELS, SEASONS } from "@/lib/workshop-timeline";
import type { ApiSchema } from "@/types/api-helpers";
import {
    formatEnergy,
    formatMass,
    formatPower,
} from "@energetica/core/format-utils";
import { Money } from "@energetica/ui/components/money";
import { cn } from "@energetica/ui/lib/utils";

type WorkshopFacility = ApiSchema<"WorkshopFacilityOut">;
type FuelType = ApiSchema<"Fuel">;

const WH_PER_MWH = 1_000_000;

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
    const inputs = useTooltipInputs();
    const { buyRound } = inputs;
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
                    className={cn(
                        "mt-1 aspect-[16/10] w-full rounded-md object-cover",
                        // Every card is the same height. A storage card has one
                        // stat row (25px) fewer, but its headline figures take
                        // two lines, 12.5px more than a name: the gap below its
                        // image makes up the rest.
                        isStorage(facility) ? "mb-[18.5px]" : "mb-1.5",
                    )}
                />
                <ul className="divide-y divide-stone-300 text-xs dark:divide-stone-700">
                    {facilityStats(facility, inputs).map((stat) => (
                        <MetricTooltip key={stat.label} content={stat.tooltip}>
                            <li className="flex items-center gap-2 py-1">
                                <stat.icon
                                    className="size-3.5 shrink-0"
                                    style={{
                                        color: workshopFacilityColor(
                                            facility.id,
                                        ),
                                    }}
                                />
                                <span className="flex flex-1 items-center gap-1">
                                    {stat.label}
                                    {stat.tooltip && <InfoMark />}
                                </span>
                                <span className="font-bold">{stat.value}</span>
                            </li>
                        </MetricTooltip>
                    ))}
                </ul>
                {footer ?? (
                    <CardFooterRow
                        left="Lifetime"
                        tooltip={
                            buyRound !== null && (
                                <LifetimeTooltip
                                    rounds={workingRounds(buyRound, facility)}
                                    roundCount={inputs.roundCount}
                                    boughtIn={buyRound}
                                />
                            )
                        }
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

/**
 * A card's bottom row: a label on the left, a figure on the right, and a
 * tooltip if given.
 */
export function CardFooterRow({
    left,
    right,
    tooltip,
}: {
    left: ReactNode;
    right: ReactNode;
    tooltip?: ReactNode;
}) {
    return (
        <MetricTooltip content={tooltip}>
            <div
                className="mt-1 flex items-center justify-between border-t-2 border-stone-300 text-[11px] dark:border-stone-700"
                style={{ height: CARD_ROW_HEIGHT }}
            >
                <span className="flex items-center gap-1">
                    <span className="opacity-70">{left}</span>
                    {tooltip && <InfoMark />}
                </span>
                <span className="flex items-center gap-1.5 font-bold">
                    {right}
                </span>
            </div>
        </MetricTooltip>
    );
}

/**
 * The tooltip of a lifetime row: the Rounds the facility works in, cut short by
 * the end of the game.
 */
export function LifetimeTooltip({
    rounds,
    roundCount,
    boughtIn,
}: {
    rounds: { first: number; last: number };
    roundCount: number | null;
    /** For a facility not bought yet, the Round it would be bought in. */
    boughtIn?: number;
}) {
    const ends = roundCount !== null && rounds.last > roundCount;
    const works =
        boughtIn === undefined
            ? "Works"
            : `Bought in Round ${boughtIn}, it works`;
    return (
        <TooltipFigure
            label={
                ends
                    ? `${works} from Round ${rounds.first} to the end of the game`
                    : `${works} from Round ${rounds.first} to Round ${rounds.last}`
            }
            note={
                ends &&
                "The game ends before its lifetime runs out. What is left of it counts in its residual value."
            }
        />
    );
}

/**
 * What the card's tooltips need beyond the facility itself: the season's fuel
 * prices, the carbon tax and the session's Rounds. The card loads these itself,
 * so every place that shows a card gets its tooltips.
 */
interface TooltipInputs {
    /**
     * Each fuel's price per kg this season, or its catalog price before the
     * first season. Empty until it loads.
     */
    fuelPrices: Partial<Record<FuelType, number>>;
    /** What a carbon tax charges per kg of CO₂, or null until it loads. */
    taxRate: number | null;
    /**
     * Whether a carbon tax vote has passed, so the tax is charged. Until then
     * the emissions have no tooltip.
     */
    taxInForce: boolean;
    /** The Round a facility bought next is bought in, or null if none is. */
    buyRound: number | null;
    roundCount: number | null;
}

function useTooltipInputs(): TooltipInputs {
    const { data: fuel } = useWorkshopFuel();
    const { data: session } = useWorkshopSession();
    const { data: vote } = useWorkshopVote();
    return {
        fuelPrices: Object.fromEntries(
            (fuel?.fuels ?? []).map((line) => [line.fuel, line.price]),
        ),
        taxRate: vote?.tax_rate ?? null,
        taxInForce: (session?.carbon_tax_since ?? null) !== null,
        buyRound: session
            ? nextBuyRound(session.checkpoint, session.round_count)
            : null,
        roundCount: session?.round_count ?? null,
    };
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
    /** What hovering the stat shows, if anything. */
    tooltip?: ReactNode;
}

function facilityStats(
    facility: WorkshopFacility,
    inputs: TooltipInputs,
): Stat[] {
    const stats: Stat[] = [];
    if (isStorage(facility)) {
        stats.push({
            label: "Efficiency",
            icon: Percent,
            value: `${Math.round(facility.base_efficiency * 100)}%`,
            tooltip: (
                <StorageMarkupNote efficiency={facility.base_efficiency} />
            ),
        });
    } else {
        stats.push({
            label: "Emissions",
            icon: Flame,
            value:
                facility.base_pollution === 0
                    ? "None"
                    : `${formatMass(facility.base_pollution)}/MWh`,
            tooltip:
                facility.base_pollution > 0 &&
                inputs.taxInForce &&
                inputs.taxRate !== null ? (
                    <CarbonTaxFigure
                        kgPerMWh={facility.base_pollution}
                        rate={inputs.taxRate}
                    />
                ) : undefined,
        });
    }
    if (facility.capacity_factor !== null) {
        stats.push({
            label: "Capacity factor",
            icon: Gauge,
            value: `${Math.round(facility.capacity_factor * 100)}%`,
            tooltip: <CapacityFactorFigures facility={facility} />,
        });
    }
    stats.push({
        label: "O&M / Round",
        icon: Wrench,
        value: <Money amount={facility.om_per_round} />,
        tooltip: <OmFigures facility={facility} />,
    });
    if (facility.fuel_use !== null && facility.fuel_type !== null) {
        stats.push({
            label: "Fuel use",
            icon: Fuel,
            value: formatFuelUse(facility.fuel_use),
            tooltip: (
                <FuelUseFigures
                    facility={facility}
                    fuel={facility.fuel_type}
                    kgPerMWh={facility.fuel_use}
                    pricePerKg={inputs.fuelPrices[facility.fuel_type]}
                />
            ),
        });
    }
    return stats;
}

/**
 * What the capacity factor means, and the energy the facility generates in each
 * season on average over many Runs' weather.
 */
function CapacityFactorFigures({ facility }: { facility: WorkshopFacility }) {
    const expected = facility.expected_generation;
    return (
        <>
            <TooltipFigure
                label="Capacity factor"
                note="Its average output over a year of weather, as a share of its maximum output."
            />
            {expected && (
                <div>
                    <div className="font-semibold">
                        Expected generation per season
                    </div>
                    <dl className="grid grid-cols-[auto_auto] justify-start gap-x-3">
                        {SEASONS.map((season) => (
                            <div key={season} className="contents">
                                <dt className="opacity-75">
                                    {SEASON_LABELS[season]}
                                </dt>
                                <dd className="text-right">
                                    {formatVolume(
                                        (expected[season] ?? 0) / WH_PER_MWH,
                                    )}{" "}
                                    MWh
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}
        </>
    );
}

/**
 * The O&M split into what is charged whatever the use and per MWh, each with
 * its share of the O&M.
 */
function OmFigures({ facility }: { facility: WorkshopFacility }) {
    const fixedShare = Math.round(facility.om_fixed_share * 100);
    return (
        <>
            <TooltipFigure
                label="Fixed"
                value={
                    <>
                        <Money amount={facility.om_fixed_per_season} /> per
                        season ({fixedShare}% share)
                    </>
                }
                note="Paid whatever you produce."
            />
            {facility.om_variable_per_mwh > 0 && (
                <TooltipFigure
                    label="Variable"
                    value={
                        <>
                            <MoneyPerMWh
                                amount={facility.om_variable_per_mwh}
                            />{" "}
                            ({100 - fixedShare}% share)
                        </>
                    }
                    note="Paid only on what you produce."
                />
            )}
        </>
    );
}

/**
 * The fuel a facility burns, what it costs per MWh at this season's price, and
 * the most it burns in a season, running at full output all season.
 */
function FuelUseFigures({
    facility,
    fuel,
    kgPerMWh,
    pricePerKg,
}: {
    facility: WorkshopFacility;
    fuel: FuelType;
    kgPerMWh: number;
    pricePerKg: number | undefined;
}) {
    return (
        <>
            <TooltipFigure label="Fuel" value={capitalize(fuel)} />
            {pricePerKg !== undefined && (
                <TooltipFigure
                    label="Fuel cost"
                    value={
                        <MoneyPerMWh
                            amount={fuelCostPerMWh(kgPerMWh, pricePerKg)}
                        />
                    }
                    note="At this season's price."
                />
            )}
            <TooltipFigure
                label="Max fuel use"
                value={`${formatMass(
                    maxFuelPerSeason(facility.full_output_per_season, kgPerMWh),
                )} per season`}
                note="Running at 100% output all season."
            />
        </>
    );
}

/** What the carbon tax costs per MWh, once one is in force. */
function CarbonTaxFigure({
    kgPerMWh,
    rate,
}: {
    kgPerMWh: number;
    rate: number;
}) {
    return (
        <TooltipFigure
            label="Carbon tax"
            value={<MoneyPerMWh amount={carbonTaxPerMWh(kgPerMWh, rate)} />}
            note={
                <>
                    At <Money amount={taxPerTonne(rate)} /> per tonne of CO₂.
                </>
            }
        />
    );
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
