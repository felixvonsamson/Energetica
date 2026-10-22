/**
 * The Recap's special report on a Round's blackouts (#1286): a headline and a
 * paragraph, which grow starker the more often the grid went down.
 *
 * Each blackout took the grid down for a day. It then came back with demand
 * rationed, a little more after each blackout, and each blackout costs every
 * player a share of the Round's operating profit.
 */

import type { ApiSchema } from "@/types/api-helpers";

import { dateOfDay, weekdayOfDay } from "./workshop-review";

type Blackout = ApiSchema<"Blackout">;

export interface BlackoutReport {
    headline: string;
    body: string;
}

// How many blackouts the report lists by date before it only counts the rest.
const LISTED = 5;

function day(blackout: Blackout): string {
    return `${weekdayOfDay(blackout.day)} ${dateOfDay(blackout.day)}`;
}

function time(blackout: Blackout): string {
    const hours = Math.floor(blackout.minute / 60);
    const minutes = blackout.minute % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function percent(share: number): string {
    return `${Math.round(share * 100)}%`;
}

/** The blackouts as "on Mon 12 Mar at 18:00, … and on Thu 6 Dec at 19:15". */
function dates(blackouts: Blackout[]): string {
    const listed = blackouts
        .slice(0, LISTED)
        .map((blackout) => `on ${day(blackout)} at ${time(blackout)}`);
    const rest = blackouts.length - listed.length;
    if (rest > 0) return `${listed.join(", ")} and ${rest} more times`;
    if (listed.length < 2) return listed.join("");
    return `${listed.slice(0, -1).join(", ")} and ${listed.at(-1)}`;
}

/**
 * The report on a Round's `blackouts`, or `null` if the grid held. `costShare`
 * is the share of operating profit they cost, and `rationing` what demand had
 * been cut to by the end of the Round, both from 0 to 1.
 */
export function blackoutReport(
    blackouts: Blackout[],
    costShare: number,
    rationing: number,
): BlackoutReport | null {
    const [first] = blackouts;
    if (!first) return null;
    const count = blackouts.length;
    const cut = percent(1 - rationing);
    const loss = `Every producer loses ${percent(costShare)} of this year's operating profit.`;
    if (count === 1) {
        return {
            headline: `Lights out on ${day(first)}`,
            body:
                `At ${time(first)} on ${day(first)} the grid could not cover the demand that must always be served, and went down. ` +
                `After 24 hours it was restarted, and electricity was rationed for the rest of the year: demand was cut by ${cut}. ` +
                loss,
        };
    }
    if (count === 2) {
        return {
            headline: "Two major blackouts this year",
            body:
                `The grid went down twice this year: ${dates(blackouts)}. ` +
                `Each time it was restarted after 24 hours with tighter rationing, and by the end of the year demand had been cut by ${cut}. ` +
                loss,
        };
    }
    if (count === 3) {
        return {
            headline: "Grid in crisis",
            body:
                `The grid failed three times this year: ${dates(blackouts)}. ` +
                "The country is losing faith in its power producers. " +
                `Rationing cut demand by ${cut} by the end of the year. ` +
                loss,
        };
    }
    return {
        headline: "Total collapse",
        body:
            `The grid failed ${count} times this year: ${dates(blackouts)}. ` +
            `Electricity has become a luxury, rationed down to ${percent(rationing)} of normal demand. ` +
            (costShare >= 1
                ? "Every producer loses this year's entire operating profit."
                : loss),
    };
}
