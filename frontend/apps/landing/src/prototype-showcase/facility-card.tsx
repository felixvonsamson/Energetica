/**
 * PROTOTYPE (#1462), throwaway. A copy of the Workshop's `FacilityCard` with
 * everything it loaded itself turned into props, to see the showcase on the
 * landing page before the card moves into `@energetica/facility-cards`.
 *
 * Changes from the Workshop's card:
 *
 * - `facility` is the package's own `FacilityCardData` shape, not `ApiSchema`.
 * - `tooltipInputs` is a prop, where the Workshop's card ran three queries.
 * - `tooltips={false}` drops every tooltip and info mark.
 * - The helpers it imported from `@/lib/workshop-*` are inlined below.
 * - `PriceTagFace` is the front of the price tag only: no flip, no buying.
 */

import {
    formatEnergy,
    formatMass,
    formatPower,
} from "@energetica/core/format-utils";
import coalBurner from "@energetica/ui/assets/facilities/power/coal_burner.webp";
import nuclearReactor from "@energetica/ui/assets/facilities/power/nuclear_reactor.webp";
import offshoreWindTurbine from "@energetica/ui/assets/facilities/power/offshore_wind_turbine.webp";
import pvSolar from "@energetica/ui/assets/facilities/power/PV_solar.webp";
import lithiumIonBatteries from "@energetica/ui/assets/facilities/storage/lithium_ion_batteries.webp";
import { Money } from "@energetica/ui/components/money";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@energetica/ui/components/tooltip";
import { assetCSSColourVariable } from "@energetica/ui/lib/asset-colors";
import { cn } from "@energetica/ui/lib/utils";
import {
    BatteryFull,
    Flame,
    Fuel,
    Gauge,
    Info,
    type LucideIcon,
    Percent,
    Wrench,
    Zap,
} from "lucide-react";
import type { ReactElement, ReactNode } from "react";

type Season = "spring" | "summer" | "autumn" | "winter";
type FuelType = "coal" | "gas" | "uranium";

/** The shape the package would declare. The Workshop maps its API data onto it. */
export interface FacilityCardData {
    id: string;
    name: string;
    base_power_generation: number;
    base_storage_capacity: number | null;
    base_efficiency: number | null;
    construction_lag_rounds: number;
    lifetime_rounds: number;
    om_per_round: number;
    om_fixed_share: number;
    base_pollution: number;
    fuel_type: FuelType | null;
    max_owned: number | null;
    base_price: number;
    price: number;
    fuel_use: number | null;
    capacity_factor: number | null;
    om_fixed_per_season: number;
    om_variable_per_mwh: number;
    full_output_per_season: number;
    expected_generation: Partial<Record<Season, number>> | null;
}

export interface TooltipInputs {
    fuelPrices: Partial<Record<FuelType, number>>;
    taxRate: number | null;
    taxInForce: boolean;
}

// The prototype only ships the five showcase images. The package would hold
// the full record, typed by facility id.
const IMAGES: Record<string, string> = {
    pv_solar: pvSolar,
    offshore_wind_turbine: offshoreWindTurbine,
    lithium_ion_batteries: lithiumIonBatteries,
    nuclear_reactor: nuclearReactor,
    coal_burner: coalBurner,
};

const WH_PER_MWH = 1_000_000;
const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
const SEASON_LABELS: Record<Season, string> = {
    spring: "Spring",
    summer: "Summer",
    autumn: "Autumn",
    winter: "Winter",
};

const color = (id: string) => assetCSSColourVariable(id);
const isStorage = (f: FacilityCardData) =>
    f.base_storage_capacity !== null && f.base_efficiency !== null;
const roundsLabel = (n: number) => `${n} ${n === 1 ? "Round" : "Rounds"}`;
const formatFuelUse = (kg: number) => `${Number(kg.toPrecision(3))} kg/MWh`;
const group = (v: number) =>
    Math.round(v)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
const formatVolume = (v: number) =>
    Math.abs(v) < 10 && v % 1 !== 0 ? v.toFixed(1) : group(v);
const formatRate = (v: number) => (Math.abs(v) < 100 ? v.toFixed(1) : group(v));
function formatCatalogPrice(amount: number): string {
    const tenths = Math.round(amount / 100_000);
    const whole = group(Math.trunc(tenths / 10));
    const decimal = Math.abs(tenths % 10);
    return decimal === 0 ? `${whole}M` : `${whole}.${decimal}M`;
}

export function cardFrame(id: string): string {
    const c = color(id);
    return `linear-gradient(135deg, ${c}, color-mix(in srgb, ${c} 45%, white))`;
}

export function FacilityCard({
    facility,
    tooltipInputs,
    tooltips = true,
    className,
}: {
    facility: FacilityCardData;
    tooltipInputs: TooltipInputs;
    /** False drops every tooltip and info mark. */
    tooltips?: boolean;
    className?: string;
}) {
    return (
        <div
            className={cn("relative w-60 rounded-2xl p-2 shadow-lg", className)}
            style={{ background: cardFrame(facility.id) }}
        >
            <div className="rounded-xl bg-amber-50 p-2 text-stone-900 dark:bg-stone-900 dark:text-stone-100">
                <div className="flex items-start justify-between gap-2">
                    <span className="text-sm leading-tight font-extrabold">
                        {facility.name}
                    </span>
                    <HeadlineFigures facility={facility} />
                </div>
                <img
                    src={IMAGES[facility.id]}
                    alt=""
                    className={cn(
                        "mt-1 aspect-[16/10] w-full rounded-md object-cover",
                        isStorage(facility) ? "mb-[18.5px]" : "mb-1.5",
                    )}
                />
                <ul className="divide-y divide-stone-300 text-xs dark:divide-stone-700">
                    {facilityStats(facility, tooltipInputs).map((stat) => {
                        const tip = tooltips ? stat.tooltip : undefined;
                        return (
                            <MetricTooltip key={stat.label} content={tip}>
                                <li className="flex items-center gap-2 py-1">
                                    <stat.icon
                                        className="size-3.5 shrink-0"
                                        style={{ color: color(facility.id) }}
                                    />
                                    <span className="flex flex-1 items-center gap-1">
                                        {stat.label}
                                        {tip && <InfoMark />}
                                    </span>
                                    <span className="font-bold">
                                        {stat.value}
                                    </span>
                                </li>
                            </MetricTooltip>
                        );
                    })}
                </ul>
                <div
                    className="mt-1 flex items-center justify-between border-t-2 border-stone-300 text-[11px] dark:border-stone-700"
                    style={{ height: 30 }}
                >
                    <span className="opacity-70">Lifetime</span>
                    <span className="flex items-center gap-1.5 font-bold">
                        <LifetimePips
                            total={facility.lifetime_rounds}
                            color={color(facility.id)}
                        />
                        {roundsLabel(facility.lifetime_rounds)}
                    </span>
                </div>
            </div>
        </div>
    );
}

/** The front of the price tag, with its string. Display only. */
export function PriceTagFace({
    facility,
    className,
}: {
    facility: FacilityCardData;
    className?: string;
}) {
    const lag = facility.construction_lag_rounds;
    return (
        <div className={cn("flex flex-col items-center", className)}>
            <div className="h-4 w-px bg-muted-foreground" />
            <div className="relative flex -rotate-2 flex-col items-center justify-center rounded-md border border-border bg-amber-100 px-3 py-1.5 text-stone-900 shadow-sm">
                <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full border border-stone-400 bg-background" />
                <Money
                    amount={facility.price}
                    format={formatCatalogPrice}
                    className="block text-center text-sm font-extrabold [&>svg]:translate-y-[0.08em]"
                />
                {lag > 0 && (
                    <span className="mt-0.5 text-[10px] font-bold whitespace-nowrap">
                        Needs {roundsLabel(lag)} to build
                    </span>
                )}
            </div>
        </div>
    );
}

function MetricTooltip({
    content,
    children,
}: {
    content: ReactNode;
    children: ReactElement;
}) {
    if (content === undefined || content === null || content === false)
        return children;
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent
                side="right"
                className="flex max-w-80 flex-col gap-1.5 py-2 text-left text-sm leading-snug text-wrap"
            >
                {content}
            </TooltipContent>
        </Tooltip>
    );
}

function InfoMark() {
    return <Info className="size-3 shrink-0 opacity-50" aria-hidden />;
}

function TooltipFigure({
    label,
    value,
    note,
}: {
    label: ReactNode;
    value?: ReactNode;
    note?: ReactNode;
}) {
    return (
        <div>
            <div>
                <span className="font-semibold">{label}</span>
                {value !== undefined && <>: {value}</>}
            </div>
            {note && <div className="opacity-75">{note}</div>}
        </div>
    );
}

function MoneyPerMWh({ amount }: { amount: number }) {
    return (
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
            <Money amount={amount} format={formatRate} />
            /MWh
        </span>
    );
}

function LifetimePips({ total, color }: { total: number; color: string }) {
    return (
        <span className="inline-flex gap-0.5" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
                <span
                    key={i}
                    className="size-2 rounded-full border"
                    style={{ borderColor: color, backgroundColor: color }}
                />
            ))}
        </span>
    );
}

function HeadlineFigures({ facility }: { facility: FacilityCardData }) {
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
                {formatEnergy(facility.base_storage_capacity!)}
            </span>
        </span>
    );
}

interface Stat {
    label: string;
    icon: LucideIcon;
    value: ReactNode;
    tooltip?: ReactNode;
}

function facilityStats(f: FacilityCardData, inputs: TooltipInputs): Stat[] {
    const stats: Stat[] = [];
    if (isStorage(f)) {
        const markup = Math.round((1 / f.base_efficiency! - 1) * 100);
        stats.push({
            label: "Efficiency",
            icon: Percent,
            value: `${Math.round(f.base_efficiency! * 100)}%`,
            tooltip: (
                <TooltipFigure
                    label="Storage loses energy"
                    note={`Your sell price should be at least ${markup}% higher than your buy price to make a profit.`}
                />
            ),
        });
    } else {
        stats.push({
            label: "Emissions",
            icon: Flame,
            value:
                f.base_pollution === 0
                    ? "None"
                    : `${formatMass(f.base_pollution)}/MWh`,
            tooltip:
                f.base_pollution > 0 &&
                inputs.taxInForce &&
                inputs.taxRate !== null ? (
                    <TooltipFigure
                        label="Carbon tax"
                        value={
                            <MoneyPerMWh
                                amount={f.base_pollution * inputs.taxRate}
                            />
                        }
                    />
                ) : undefined,
        });
    }
    if (f.capacity_factor !== null) {
        stats.push({
            label: "Capacity factor",
            icon: Gauge,
            value: `${Math.round(f.capacity_factor * 100)}%`,
            tooltip: <CapacityFactorFigures facility={f} />,
        });
    }
    stats.push({
        label: "O&M / Round",
        icon: Wrench,
        value: <Money amount={f.om_per_round} />,
        tooltip: <OmFigures facility={f} />,
    });
    if (f.fuel_use !== null && f.fuel_type !== null) {
        const price = inputs.fuelPrices[f.fuel_type];
        stats.push({
            label: "Fuel use",
            icon: Fuel,
            value: formatFuelUse(f.fuel_use),
            tooltip: (
                <>
                    <TooltipFigure
                        label="Fuel"
                        value={
                            f.fuel_type.charAt(0).toUpperCase() +
                            f.fuel_type.slice(1)
                        }
                    />
                    {price !== undefined && (
                        <TooltipFigure
                            label="Fuel cost"
                            value={<MoneyPerMWh amount={f.fuel_use * price} />}
                            note="At the catalog price."
                        />
                    )}
                    <TooltipFigure
                        label="Max fuel use"
                        value={`${formatMass((f.full_output_per_season / WH_PER_MWH) * f.fuel_use)} per season`}
                        note="Running at 100% output all season."
                    />
                </>
            ),
        });
    }
    return stats;
}

function CapacityFactorFigures({ facility }: { facility: FacilityCardData }) {
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

function OmFigures({ facility }: { facility: FacilityCardData }) {
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
