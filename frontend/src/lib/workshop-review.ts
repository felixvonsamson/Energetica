/**
 * Shaping a settled Trading period's record for its review charts (#1007).
 *
 * The API gives one simulated week at a time: the price at each settlement
 * point, and for each player's facility type its generation, dumped power and
 * charging. These functions turn that into the rows the time-series charts
 * draw, one per settlement point, keyed by `tick`: the point's number in the
 * whole period, so the scrubber, the charts and the merit order agree on it.
 *
 * - A player generates what each facility type produced. They consume what they
 *   sold to the market (`exports`), what their storage charged, and what they
 *   dumped.
 * - The market generates what every facility produced, by type or by player. It
 *   consumes what each demand tier was served, plus all charging and dumping.
 *   By player, the demand tiers add up to one `consumers` series, and each
 *   player's series is their charging and dumping.
 */

import type { MeritOrderData } from "@/components/charts/merit-order-view";
import type { ApiSchema } from "@/types/api-helpers";

type PeriodWeek = ApiSchema<"WorkshopPeriodWeekOut">;
type Pool = ApiSchema<"WorkshopPoolSeriesOut">;
type MeritOrder = ApiSchema<"WorkshopMeritOrderOut">;
type Orders = ApiSchema<"WorkshopOrdersOut">;

export type PowerView = "generation" | "consumption";
export type NetworkGrouping = "type" | "player";

/** One settlement point's values, by series key. */
export type ChartRow = { tick: number } & Record<string, number>;

export const EXPORTS = "exports";
export const DUMPING = "dumping";
export const CONSUMERS = "consumers";

/** The demand tiers' display names, from must-serve down. */
export const TIER_NAMES: Record<string, string> = {
    must_serve: "Must-serve demand",
    low_flex: "Low-flexibility demand",
    medium_flex: "Medium-flexibility demand",
    high_flex: "High-flexibility demand",
    very_high_flex: "Very high-flexibility demand",
    opportunistic: "Opportunistic demand",
};

/** Rows for the week's points, each starting with every key at zero. */
function emptyRows(week: PeriodWeek, keys: Iterable<string>): ChartRow[] {
    const zeros = Object.fromEntries([...keys].map((key) => [key, 0]));
    return week.price.map(
        (_, i) => ({ tick: week.first_point + i, ...zeros }) as ChartRow,
    );
}

function addSeries(rows: ChartRow[], key: string, values: number[]): void {
    values.forEach((value, i) => {
        const row = rows[i];
        if (row) row[key] = (row[key] ?? 0) + value;
    });
}

function sold(pool: Pool): number[] {
    return pool.generation.map((value, i) => value - (pool.dumped[i] ?? 0));
}

/** Whether the pool charged at any point this week. */
function hasCharged(pool: Pool): boolean {
    return pool.charged.some((value) => value > 0);
}

/** One player's generation or consumption over the week. */
export function playerPowerRows(
    week: PeriodWeek,
    playerId: number,
    view: PowerView,
): ChartRow[] {
    const pools = week.pools.filter((pool) => pool.player_id === playerId);
    const rows = emptyRows(week, []);
    for (const pool of pools) {
        if (view === "generation") {
            addSeries(rows, pool.facility, pool.generation);
        } else {
            addSeries(rows, EXPORTS, sold(pool));
            addSeries(rows, DUMPING, pool.dumped);
            if (hasCharged(pool)) addSeries(rows, pool.facility, pool.charged);
        }
    }
    return rows;
}

/** The whole market's generation or consumption over the week. */
export function networkPowerRows(
    week: PeriodWeek,
    view: PowerView,
    grouping: NetworkGrouping,
): ChartRow[] {
    const rows = emptyRows(week, []);
    if (view === "generation") {
        for (const pool of week.pools) {
            const key =
                grouping === "type" ? pool.facility : String(pool.player_id);
            addSeries(rows, key, pool.generation);
        }
        return rows;
    }
    for (const tier of week.tiers) {
        addSeries(
            rows,
            grouping === "type" ? tier.tier : CONSUMERS,
            tier.served,
        );
    }
    for (const pool of week.pools) {
        if (grouping === "type") {
            if (hasCharged(pool)) addSeries(rows, pool.facility, pool.charged);
            addSeries(rows, DUMPING, pool.dumped);
        } else {
            const key = String(pool.player_id);
            addSeries(rows, key, pool.charged);
            addSeries(rows, key, pool.dumped);
        }
    }
    return rows;
}

/**
 * The market price at each point. Where the grid was down there is none, and
 * the value is `NaN`, which the chart leaves as a gap.
 */
export function priceRows(week: PeriodWeek): ChartRow[] {
    return week.price.map(
        (price, i) =>
            ({ tick: week.first_point + i, price: price ?? NaN }) as ChartRow,
    );
}

/**
 * The keys present in `rows`, in `preferred` order first, then the rest in the
 * order they first appear. Keys whose values are all zero are left out.
 */
export function orderedKeys(
    rows: ChartRow[],
    preferred: readonly string[],
): string[] {
    const present = new Set<string>();
    for (const row of rows) {
        for (const [key, value] of Object.entries(row)) {
            if (key !== "tick" && value !== 0) present.add(key);
        }
    }
    const first = preferred.filter((key) => present.has(key));
    const rest = [...present].filter((key) => !first.includes(key));
    return [...first, ...rest];
}

/** Energy of one series over the rows, in Wh. */
export function seriesEnergy(
    rows: ChartRow[],
    key: string,
    hoursPerPoint: number,
): number {
    return rows.reduce((sum, row) => sum + (row[key] ?? 0), 0) * hoursPerPoint;
}

function bids(orders: Orders) {
    return {
        ...orders,
        price: orders.price.map((price) => price ?? Infinity),
    };
}

/** A settlement point's merit order as the chart takes it. */
export function meritOrderData(order: MeritOrder): MeritOrderData {
    return {
        capacities: bids(order.offers),
        demands: bids(order.demands),
        market_price: order.price ?? Infinity,
        market_quantity: order.quantity,
    };
}

/** The time of day a settlement point starts at, as `HH:MM`. */
export function timeOfDay(point: number, clearingsPerDay: number): string {
    const minutes = Math.round(
        ((point % clearingsPerDay) * 24 * 60) / clearingsPerDay,
    );
    const hours = Math.floor(minutes / 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
});

/** A day of the Workshop year, counted from 0 on 1 January, as "12 Mar". */
export function dateOfDay(dayOfYear: number): string {
    // A non-leap year, the calendar the demand curve and seasons use.
    return DATE_FORMAT.format(new Date(Date.UTC(2001, 0, 1 + dayOfYear)));
}

/** The days in a simulated week. */
export const WEEK_DAYS = 7;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * The weekday of a day of the Workshop year, as "Mon". The year starts on a
 * Monday.
 */
export function weekdayOfDay(dayOfYear: number): string {
    return WEEKDAYS[dayOfYear % WEEK_DAYS] ?? "";
}

/** A day of the Workshop year as "Mon 12 Mar". */
function dayLabel(dayOfYear: number): string {
    return `${weekdayOfDay(dayOfYear)} ${dateOfDay(dayOfYear)}`;
}

/**
 * The weekday, date and time a settlement point of the period starts at, as
 * "Mon 12 Mar, 06:00".
 */
export function pointTime(
    point: number,
    days: readonly number[],
    clearingsPerDay: number,
): string {
    const dayOfYear = days[Math.floor(point / clearingsPerDay)];
    const date = dayOfYear === undefined ? "" : `${dayLabel(dayOfYear)}, `;
    return `${date}${timeOfDay(point, clearingsPerDay)}`;
}

/**
 * A settlement point's label on a chart's time axis: "Mon 12 Mar" at midnight,
 * where a day starts, and "Mon 06:00" at any other time.
 */
export function pointAxisLabel(
    point: number,
    days: readonly number[],
    clearingsPerDay: number,
): string {
    const dayOfYear = days[Math.floor(point / clearingsPerDay)];
    if (dayOfYear === undefined) return timeOfDay(point, clearingsPerDay);
    if (point % clearingsPerDay === 0) return dayLabel(dayOfYear);
    return `${weekdayOfDay(dayOfYear)} ${timeOfDay(point, clearingsPerDay)}`;
}

/**
 * The weeks that can be reviewed, each as the days of the year it simulated:
 * all of them, or up to the week the grid went down in. Weeks after a blackout
 * never cleared.
 */
export function reviewableWeeks(
    days: readonly number[],
    blackoutAt: number | null,
    clearingsPerDay: number,
): number[][] {
    const weeks: number[][] = [];
    for (let start = 0; start < days.length; start += WEEK_DAYS) {
        weeks.push(days.slice(start, start + WEEK_DAYS));
    }
    if (blackoutAt === null) return weeks;
    const pointsPerWeek = WEEK_DAYS * clearingsPerDay;
    return weeks.slice(0, Math.floor(blackoutAt / pointsPerWeek) + 1);
}

/** Whether `point` is one of the settlement points of the `week`-th week. */
export function isPointOfWeek(
    point: number,
    week: number,
    clearingsPerDay: number,
): boolean {
    return Math.floor(point / (WEEK_DAYS * clearingsPerDay)) === week;
}
