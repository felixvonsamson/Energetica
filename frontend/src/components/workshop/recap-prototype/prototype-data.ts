/**
 * PROTOTYPE — wipe me. Mock data for the Recap page prototype (#1013).
 *
 * The real API does not yet serve headlines, room figures or next Round's
 * demand to players, so every variant reads one of these scenarios instead.
 * Headlines are copied from `src/energetica/workshop/events.py`.
 *
 * Assumption from the design session: round-boundary events (facility price
 * shocks, demand shifts) picked during Round N are told at Recap N, as what is
 * coming. Today they fire when Round N+1's Investment opens, so the backend
 * timing would have to move.
 */

import type { Season } from "@/lib/workshop-timeline";
import type { ProjectType } from "@/types/projects";

export type Tone = "bad" | "good";

export interface RecapStory {
    id: string;
    name: string;
    headline: string;
    tone: Tone;
    category: "climate" | "fuel" | "facility" | "demand";
    /** The Trading period it hit, or null for one that comes with next Round. */
    season: Season | null;
    severity?: string;
    /** A short plain-numbers line under the headline. */
    effect: string;
}

export interface RecapUnlock {
    id: ProjectType;
    facility: string;
    /** What it upgrades from, for a threshold unlock. */
    from?: string;
    why: string;
}

export interface RecapForecast {
    id: string;
    season: Season;
    /** A hint with no figures: what experts expect, never what will happen. */
    text: string;
}

export interface RecapScenario {
    label: string;
    round: number;
    roundCount: number;
    /** The season the grid went down in, if it did. */
    blackout: { season: Season; day: number } | null;
    /** Trading-period events that hit this Round. */
    happened: RecapStory[];
    /** Round-boundary events that come with the next Round. */
    coming: RecapStory[];
    unlocks: RecapUnlock[];
    /**
     * Seasonal events already picked for next Round, told as a vague outlook
     * (needs per-round lever state: see the reply in the design session).
     */
    forecasts: RecapForecast[];
    demand: {
        /** Peak demand this Round and next, in W. */
        thisRound: number;
        nextRound: number;
        /** What moves it, e.g. the demand-shift event's name. */
        drivers: string[];
    } | null;
    room: {
        emissionsRound: number; // kg
        emissionsTotal: number; // kg
        builtCapacity: number; // W, built this Round by everyone
        energySold: number; // Wh, this Round
        averagePrice: number; // per MWh
        renewableShare: number; // 0..1, of energy sold
    };
}

const busy: RecapScenario = {
    label: "Busy Round",
    round: 2,
    roundCount: 5,
    blackout: null,
    happened: [
        {
            id: "climate.heatwave",
            name: "Heatwave",
            severity: "Major",
            headline:
                "A record-breaking heatwave grips the region for weeks. Air conditioners run nonstop as cooling demand hits an all-time high.",
            tone: "bad",
            category: "climate",
            season: "summer",
            effect: "Demand +18% for the summer",
        },
        {
            id: "climate.wildfire",
            name: "Wildfire season",
            severity: "Moderate",
            headline:
                "Wildfires force the evacuation of a substation — grid operators reroute power across the region while crews fight the blaze.",
            tone: "bad",
            category: "climate",
            season: "autumn",
            effect: "3% of every player's autumn sales lost",
        },
        {
            id: "geo.gas_pipeline_disruption",
            name: "Gas pipeline disruption",
            headline:
                "A key gas pipeline is shut down amid a dispute between transit nations. Spot prices spike as buyers scramble for alternatives.",
            tone: "bad",
            category: "fuel",
            season: "winter",
            effect: "Gas price ×1.5 in winter, easing after",
        },
    ],
    coming: [
        {
            id: "demand.ev_tipping_point",
            name: "Electric-vehicle tipping point",
            headline:
                "Electric vehicles cross the halfway mark of new car sales in the region — charging load becomes a real factor on the grid.",
            tone: "bad",
            category: "demand",
            season: null,
            effect: "Demand +12% from Round 3 on",
        },
        {
            id: "geo.wind_supply_war",
            name: "War disrupts the wind-turbine supply chain",
            headline:
                "The country that is the main producer of wind-turbine parts is embroiled in a civil war. Costs are expected to rise 35% next quarter.",
            tone: "bad",
            category: "facility",
            season: null,
            effect: "Wind turbines cost 35% more in Round 3",
        },
    ],
    unlocks: [
        {
            id: "offshore_wind_turbine",
            facility: "Offshore wind",
            from: "Onshore wind",
            why: "The room has spent enough on onshore wind",
        },
        {
            id: "CSP_solar",
            facility: "Concentrated solar power",
            why: "Available from Round 3",
        },
    ],
    forecasts: [
        {
            id: "climate.heatwave",
            season: "summer",
            text: "Climate scientists expect an unusually warm summer. If they are right, air conditioners could run harder than usual and push power consumption up.",
        },
        {
            id: "geo.gas_discovery",
            season: "winter",
            text: "Exploratory drilling off the coast is said to look promising. Some traders are betting that gas gets cheaper before winter.",
        },
    ],
    demand: {
        thisRound: 412e6,
        nextRound: 461e6,
        drivers: ["Electric-vehicle tipping point"],
    },
    room: {
        emissionsRound: 1.84e9,
        emissionsTotal: 3.1e9,
        builtCapacity: 286e6,
        energySold: 2.71e12,
        averagePrice: 87.4,
        renewableShare: 0.38,
    },
};

const blackout: RecapScenario = {
    label: "Blackout",
    round: 1,
    roundCount: 5,
    blackout: { season: "autumn", day: 1 },
    happened: [
        {
            id: "climate.cold_snap",
            name: "Cold snap",
            severity: "Moderate",
            headline:
                "A sharp cold snap sends heating demand climbing — heat pumps work overtime to keep up.",
            tone: "bad",
            category: "climate",
            season: "autumn",
            effect: "Demand +10% for the autumn",
        },
    ],
    coming: [
        {
            id: "geo.pv_megafactory",
            name: "New PV megafactory comes online",
            headline:
                "A newly opened gigafactory floods the market with cheap solar panels, undercutting existing suppliers.",
            tone: "good",
            category: "facility",
            season: null,
            effect: "Solar panels cost 20% less in Round 2",
        },
    ],
    unlocks: [],
    forecasts: [
        {
            id: "climate.flood",
            season: "spring",
            text: "Hydrologists point to a heavy snowpack in the mountains and warn that rivers could run high when it melts this spring.",
        },
    ],
    demand: {
        thisRound: 380e6,
        nextRound: 380e6,
        drivers: [],
    },
    room: {
        emissionsRound: 1.26e9,
        emissionsTotal: 1.26e9,
        builtCapacity: 340e6,
        energySold: 1.32e12,
        averagePrice: 142.0,
        renewableShare: 0.21,
    },
};

const quiet: RecapScenario = {
    label: "Quiet Round",
    round: 3,
    roundCount: 5,
    blackout: null,
    happened: [],
    coming: [],
    unlocks: [],
    forecasts: [],
    demand: {
        thisRound: 461e6,
        nextRound: 461e6,
        drivers: [],
    },
    room: {
        emissionsRound: 1.1e9,
        emissionsTotal: 4.2e9,
        builtCapacity: 95e6,
        energySold: 3.05e12,
        averagePrice: 64.9,
        renewableShare: 0.52,
    },
};

const finalRound: RecapScenario = {
    label: "Last Round",
    round: 5,
    roundCount: 5,
    blackout: null,
    happened: [
        {
            id: "climate.mild_season",
            name: "Mild season",
            headline:
                "An unusually mild season keeps both heating and cooling demand low — a quiet quarter for grid operators.",
            tone: "good",
            category: "climate",
            season: "spring",
            effect: "Demand −3% for the spring",
        },
    ],
    coming: [],
    unlocks: [],
    forecasts: [],
    demand: null,
    room: {
        emissionsRound: 0.7e9,
        emissionsTotal: 6.4e9,
        builtCapacity: 40e6,
        energySold: 3.4e12,
        averagePrice: 58.2,
        renewableShare: 0.71,
    },
};

export const SCENARIOS = {
    busy,
    blackout,
    quiet,
    final: finalRound,
} satisfies Record<string, RecapScenario>;

export type ScenarioKey = keyof typeof SCENARIOS;

export function isScenarioKey(value: unknown): value is ScenarioKey {
    return typeof value === "string" && value in SCENARIOS;
}

export function demandChange(scenario: RecapScenario): number | null {
    if (!scenario.demand) return null;
    return scenario.demand.nextRound / scenario.demand.thisRound - 1;
}

export function formatPercent(change: number): string {
    const sign = change > 0 ? "+" : change < 0 ? "−" : "±";
    return `${sign}${Math.abs(change * 100).toFixed(0)}%`;
}
