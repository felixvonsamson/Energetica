/**
 * The control room (#1289): the projector dashboard that shows the whole room
 * what can help it decide, in the style of a grid operator's control room.
 *
 * The page is a fixed 1920×1080 canvas, scaled as a whole to fit the screen, so
 * its layout never changes. Its figures come from one read of the server (`GET
 * /workshop/control-room`), plus the session for the header. This file holds
 * the wording and the scales; the panels are in
 * `components/workshop/control-room/`.
 */

import {
    type Checkpoint,
    SEASON_LABELS,
    type Season,
    checkpointLabel,
} from "@/lib/workshop-timeline";
import type { ApiSchema } from "@/types/api-helpers";

import { dateOfDay, weekdayOfDay } from "./workshop-review";

type Alarm = ApiSchema<"ControlRoom">["alarms"][number];
type EventCategory = ApiSchema<"EventAlarm">["category"];
type RoomPrices = ApiSchema<"RoomPrices">;
type Session = ApiSchema<"WorkshopSessionOut">;

/** The canvas size the page is laid out at. */
export const CANVAS_WIDTH = 1920;
export const CANVAS_HEIGHT = 1080;

/**
 * How much to scale the canvas so it fits a window of `width` by `height`: down
 * on a smaller screen, up on a larger one.
 */
export function canvasScale(width: number, height: number): number {
    return Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT);
}

const SEASON_SHORT: Record<Season, string> = {
    spring: "Spr",
    summer: "Sum",
    autumn: "Aut",
    winter: "Win",
};

/**
 * A Trading period as "R3 Sum", or a Round's Investment phase as "R3 Inv" when
 * there is no season.
 */
export function periodLabel(round: number, season: Season | null): string {
    return `R${round} ${season === null ? "Inv" : SEASON_SHORT[season]}`;
}

export type AlarmLevel = "critical" | "warning" | "info";

/** An alarm as the panel lists it. */
export interface AlarmLine {
    when: string;
    level: AlarmLevel;
    tag: string;
    /** The whole line, for the newest alarms. */
    text: string;
    /** A word or two, for the older ones. */
    short: string;
}

const EVENT_TAGS: Record<EventCategory, string> = {
    climate: "CLIMATE",
    price_shock_geopolitical: "SHOCK",
    demand_shift: "DEMAND",
    tech_unlock: "UNLOCK",
    vote: "VOTE",
};

function percent(share: number): string {
    return `${Math.round(share * 100)}%`;
}

function clockTime(minute: number): string {
    const hours = Math.floor(minute / 60);
    const minutes = minute % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** What the carbon tax charges per tonne of CO₂, from its rate per kg. */
export function taxPerTonne(ratePerKg: number): number {
    return Math.round(ratePerKg * 1000);
}

/** How the alarm panel lists `alarm`. */
export function alarmLine(alarm: Alarm): AlarmLine {
    // An unlock has no season: it lands with the Round.
    const when = periodLabel(alarm.round, alarm.season ?? null);
    switch (alarm.kind) {
        case "event":
            return {
                when,
                level: "warning",
                tag: EVENT_TAGS[alarm.category],
                text: `${alarm.name}: ${alarm.effect}`,
                short: alarm.name,
            };
        case "blackout": {
            const day = `${weekdayOfDay(alarm.day)} ${dateOfDay(alarm.day)}`;
            return {
                when,
                level: "critical",
                tag: "BLACKOUT",
                text: `Grid down on ${day} at ${clockTime(alarm.minute)}, for a day`,
                short: day,
            };
        }
        case "rationing": {
            const cut = `−${percent(1 - alarm.rationing)}`;
            return {
                when,
                level: "warning",
                tag: "RATION",
                text: `Demand rationed ${cut} until the end of Round ${alarm.round}`,
                short: cut,
            };
        }
        case "unlock":
            return {
                when,
                level: "info",
                tag: "UNLOCK",
                text: `${alarm.name} can be bought from now on`,
                short: alarm.name,
            };
        case "vote":
            if (alarm.passed === null)
                return {
                    when,
                    level: "info",
                    tag: "VOTE",
                    text: "Carbon tax vote open until the Investment phase closes",
                    short: "vote open",
                };
            return {
                when,
                level: "info",
                tag: "VOTE",
                text: alarm.passed
                    ? `Carbon tax passed: ${taxPerTonne(alarm.tax_rate)} per tonne of CO₂ from now on`
                    : "Carbon tax rejected",
                short: alarm.passed ? "tax passed" : "tax rejected",
            };
        default:
            throw alarm satisfies never;
    }
}

/**
 * A fuel's price as the panel shows it: coal and gas per tonne, uranium per kg.
 * The server prices every fuel per kg.
 */
export function fuelPrice(
    fuel: ApiSchema<"Fuel">,
    pricePerKg: number,
): { value: number; unit: "/t" | "/kg" } {
    return fuel === "uranium"
        ? { value: pricePerKg, unit: "/kg" }
        : { value: pricePerKg * 1000, unit: "/t" };
}

// Written out rather than read from the generated types: the server's `dict[PriceGroup, PriceBox]` comes out
// as an index signature, whose keys are any string.
export type PriceGroup =
    | "coal"
    | "gas"
    | "nuclear"
    | "hydro"
    | "wind"
    | "solar"
    | "storage_sell"
    | "storage_buy";
export type PriceScale = "controllable" | "renewable" | "storage";

/**
 * The room's price boxes, in the grid's order: controllable sources and storage
 * selling on top, renewables and storage buying below. The sources of one scale
 * share a price axis.
 */
export const PRICE_GROUPS: {
    group: PriceGroup;
    name: string;
    scale: PriceScale;
}[] = [
    { group: "coal", name: "Coal", scale: "controllable" },
    { group: "gas", name: "Gas", scale: "controllable" },
    { group: "nuclear", name: "Nuclear", scale: "controllable" },
    { group: "storage_sell", name: "Storage sell", scale: "storage" },
    { group: "hydro", name: "Hydro", scale: "renewable" },
    { group: "wind", name: "Wind", scale: "renewable" },
    { group: "solar", name: "Solar", scale: "renewable" },
    { group: "storage_buy", name: "Storage buy", scale: "storage" },
];

/** The highest price a box chart shows. A higher price ends in an arrow. */
export const PRICE_CAP = 300;

function niceMax(value: number): number {
    const step = value > 100 ? 50 : 20;
    return Math.min(PRICE_CAP, Math.max(step, Math.ceil(value / step) * step));
}

/** The top of each price scale: its highest price rounded up, at most 300. */
export function priceScales(periods: RoomPrices[]): Record<PriceScale, number> {
    const highest: Record<PriceScale, number> = {
        controllable: 0,
        renewable: 0,
        storage: 0,
    };
    for (const { group, scale } of PRICE_GROUPS) {
        for (const period of periods) {
            const box = period.boxes[group];
            if (box) highest[scale] = Math.max(highest[scale], box.high);
        }
    }
    return {
        controllable: niceMax(highest.controllable),
        renewable: niceMax(highest.renewable),
        storage: niceMax(highest.storage),
    };
}

/** The phase as the header shows it, under the Round. */
export interface ControlRoomPhase {
    round: number;
    phase: string;
    /** What comes next, or `null` once the session is over. */
    next: string | null;
}

function phaseName(checkpoint: Checkpoint): string {
    switch (checkpoint.kind) {
        case "not_started":
            return "Waiting to start";
        case "investment":
            return "Investment phase";
        case "trading_period":
            return `${SEASON_LABELS[checkpoint.season]} trading`;
        case "recap":
            return "Recap";
        case "finished":
            return "Session over";
        default:
            throw checkpoint satisfies never;
    }
}

/**
 * Where the session is, for the header. `windowOpen` is whether the Investment
 * phase or a price-setting window is open.
 */
export function controlRoomPhase(
    session: Session,
    windowOpen: boolean,
): ControlRoomPhase {
    const { checkpoint } = session;
    const round =
        checkpoint.kind === "not_started"
            ? 1
            : checkpoint.kind === "finished"
              ? session.round_count
              : checkpoint.round;
    let next: string | null = session.next_checkpoint
        ? `Next: ${checkpointLabel(session.next_checkpoint)}`
        : null;
    if (checkpoint.kind === "trading_period") {
        const season = checkpoint.season;
        if (windowOpen) next = `Prices close for ${season}`;
        else if (session.settlement) next = `Simulating ${season}`;
    } else if (checkpoint.kind === "investment" && windowOpen) {
        next = "Investments close";
    }
    return { round, phase: phaseName(checkpoint), next };
}

/** A number with about three significant figures, such as 1.25, 82.4 or 540. */
function threeFigures(value: number): string {
    const digits = value < 10 ? 2 : value < 100 ? 1 : 0;
    return value.toFixed(digits);
}

/** A mass of CO₂ given in kg, as "1.25 Mt", "82.4 kt" or "540 t". */
export function formatCo2(kg: number): string {
    const tonnes = kg / 1000;
    if (tonnes >= 1e6) return `${threeFigures(tonnes / 1e6)} Mt`;
    if (tonnes >= 1e3) return `${threeFigures(tonnes / 1e3)} kt`;
    return `${threeFigures(tonnes)} t`;
}

/**
 * The unit a chart of energy shows, given the largest value in Wh: TWh once it
 * reaches one, and GWh below.
 */
export function energyScale(maxWh: number): {
    unit: "TWh" | "GWh";
    divisor: number;
} {
    return maxWh >= 1e12
        ? { unit: "TWh", divisor: 1e12 }
        : { unit: "GWh", divisor: 1e9 };
}

/** Power given in W, as "620 MW" below a GW and "1.23 GW" above. */
export function formatPower(watts: number): string {
    return watts >= 1e9
        ? `${(watts / 1e9).toFixed(2)} GW`
        : `${Math.round(watts / 1e6)} MW`;
}

/** Energy given in Wh, as "450 MWh" below a GWh and "2.50 GWh" above. */
export function formatStoredEnergy(wattHours: number): string {
    return wattHours >= 1e9
        ? `${(wattHours / 1e9).toFixed(2)} GWh`
        : `${Math.round(wattHours / 1e6)} MWh`;
}

type BlackoutRisk = ApiSchema<"BlackoutRisk">;

const RISK_LABELS: Record<BlackoutRisk, string> = {
    guaranteed: "Blackout guaranteed",
    likely: "Blackout likely",
    unlikely: "Blackout unlikely",
    very_unlikely: "Blackout very unlikely",
};

/** How the capacity panel names a band of blackout risk (#1287). */
export function riskLabel(risk: BlackoutRisk): string {
    return RISK_LABELS[risk];
}
