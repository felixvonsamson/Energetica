import { describe, expect, it } from "vitest";

import type { ApiSchema } from "@/types/api-helpers";

import {
    alarmLine,
    canvasScale,
    controlRoomPhase,
    energyScale,
    formatCo2,
    formatMegawatts,
    formatMegawattHours,
    riskLabel,
    fuelPrice,
    periodLabel,
    priceScales,
    taxPerTonne,
} from "./workshop-control-room";

type Session = ApiSchema<"WorkshopSessionOut">;
type RoomPrices = ApiSchema<"RoomPrices">;

describe("canvasScale", () => {
    it("fits the 1920×1080 canvas inside the window", () => {
        expect(canvasScale(1920, 1080)).toBe(1);
        expect(canvasScale(960, 1080)).toBe(0.5);
        expect(canvasScale(3840, 1080)).toBe(1);
    });

    it("grows the canvas on a larger screen", () => {
        expect(canvasScale(3840, 2160)).toBe(2);
    });
});

describe("periodLabel", () => {
    it("names a Trading period by its Round and season", () => {
        expect(periodLabel(3, "summer")).toBe("R3 Sum");
    });

    it("names the Investment phase when there is no season", () => {
        expect(periodLabel(2, null)).toBe("R2 Inv");
    });
});

describe("alarmLine", () => {
    it("tells an event with its effect, tagged by its category", () => {
        expect(
            alarmLine({
                kind: "event",
                round: 2,
                season: "summer",
                category: "climate",
                name: "Heatwave",
                effect: "Demand +18% for the summer",
            }),
        ).toEqual({
            when: "R2 Sum",
            level: "warning",
            tag: "CLIMATE",
            text: "Heatwave: Demand +18% for the summer",
            short: "Heatwave",
        });
        expect(
            alarmLine({
                kind: "event",
                round: 3,
                season: null,
                category: "price_shock_geopolitical",
                name: "Gas pipeline disruption",
                effect: "Gas costs 60% more",
            }).tag,
        ).toBe("SHOCK");
    });

    it("tells a blackout with the day and time the grid went down", () => {
        expect(
            alarmLine({
                kind: "blackout",
                round: 1,
                season: "summer",
                day: 160,
                minute: 1170,
            }),
        ).toEqual({
            when: "R1 Sum",
            level: "critical",
            tag: "BLACKOUT",
            text: "Grid down on Sun 10 Jun at 19:30, for a day",
            short: "Sun 10 Jun",
        });
    });

    it("tells how far rationing cuts demand", () => {
        expect(
            alarmLine({
                kind: "rationing",
                round: 2,
                season: "winter",
                rationing: 0.81,
            }),
        ).toEqual({
            when: "R2 Win",
            level: "warning",
            tag: "RATION",
            text: "Demand rationed −19% until the end of Round 2",
            short: "−19%",
        });
    });

    it("tells from which Round a facility can be bought", () => {
        expect(
            alarmLine({
                kind: "unlock",
                round: 3,
                season: null,
                facility: "offshore_wind_turbine",
                name: "Offshore wind turbine",
            }),
        ).toEqual({
            when: "R3 Inv",
            level: "info",
            tag: "UNLOCK",
            text: "Offshore wind turbine can be bought from now on",
            short: "Offshore wind turbine",
        });
    });

    it("tells a vote while it is open, and then its result", () => {
        const vote = { kind: "vote", round: 3, tax_rate: 0.025 } as const;
        expect(alarmLine({ ...vote, season: null, passed: null }).text).toBe(
            "Carbon tax vote open until the Investment phase closes",
        );
        expect(alarmLine({ ...vote, season: "spring", passed: true })).toEqual({
            when: "R3 Spr",
            level: "info",
            tag: "VOTE",
            text: "Carbon tax passed: 25 per tonne of CO₂ from now on",
            short: "tax passed",
        });
        expect(
            alarmLine({ ...vote, season: "spring", passed: false }).text,
        ).toBe("Carbon tax rejected");
    });
});

describe("taxPerTonne", () => {
    it("gives the rate per tonne of CO₂ from the rate per kg", () => {
        expect(taxPerTonne(0.025)).toBe(25);
    });
});

describe("fuelPrice", () => {
    it("prices coal and gas per tonne, and uranium per kg", () => {
        expect(fuelPrice("coal", 0.1)).toEqual({ value: 100, unit: "/t" });
        expect(fuelPrice("gas", 0.25)).toEqual({ value: 250, unit: "/t" });
        expect(fuelPrice("uranium", 250)).toEqual({ value: 250, unit: "/kg" });
    });
});

describe("priceScales", () => {
    const box = (high: number) => ({
        low: 0,
        q1: 0,
        median: 0,
        q3: 0,
        high,
    });
    const prices = (boxes: RoomPrices["boxes"]): RoomPrices => ({
        round: 1,
        season: "spring",
        live: false,
        boxes,
    });

    it("gives each group of power sources one scale, rounded up", () => {
        const scales = priceScales([
            prices({ coal: box(64), wind: box(12) }),
            prices({ gas: box(83), storage_buy: box(140) }),
        ]);
        expect(scales).toEqual({
            controllable: 100,
            renewable: 20,
            storage: 150,
        });
    });

    it("caps every scale at 300", () => {
        expect(priceScales([prices({ storage_sell: box(1000) })]).storage).toBe(
            300,
        );
    });
});

describe("controlRoomPhase", () => {
    const session = (overrides: Partial<Session>): Session => ({
        checkpoint: { kind: "not_started" },
        next_checkpoint: { kind: "investment", round: 1 },
        round_count: 5,
        phase_timer: null,
        players: [],
        round_format: {
            trading_format: "representative_week",
            clearings_per_day: 24,
            storage: "off",
        },
        settlement: null,
        blackouts: [],
        carbon_tax_since: null,
        ...overrides,
    });

    it("says what happens next before the session starts", () => {
        expect(controlRoomPhase(session({}), false)).toEqual({
            round: 1,
            phase: "Waiting to start",
            next: "Next: Round 1 · Investment",
        });
    });

    it("tells players to set prices while the window is open", () => {
        expect(
            controlRoomPhase(
                session({
                    checkpoint: {
                        kind: "trading_period",
                        round: 3,
                        season: "autumn",
                    },
                }),
                true,
            ),
        ).toEqual({
            round: 3,
            phase: "Autumn trading",
            next: "Prices close for autumn",
        });
    });

    it("says when a Trading period is being simulated", () => {
        expect(
            controlRoomPhase(
                session({
                    checkpoint: {
                        kind: "trading_period",
                        round: 3,
                        season: "autumn",
                    },
                    settlement: { days_done: 3, days_total: 14 },
                }),
                false,
            ).next,
        ).toBe("Simulating autumn");
    });

    it("says nothing comes next once the session is over", () => {
        expect(
            controlRoomPhase(
                session({
                    checkpoint: { kind: "finished" },
                    next_checkpoint: null,
                }),
                false,
            ),
        ).toEqual({ round: 5, phase: "Session over", next: null });
    });
});

describe("formatCo2", () => {
    it("picks the unit that keeps the number short", () => {
        expect(formatCo2(1_254_000_000)).toBe("1.25 Mt");
        expect(formatCo2(82_400_000)).toBe("82.4 kt");
        expect(formatCo2(540_000)).toBe("540 t");
    });
});

describe("energyScale", () => {
    it("shows energy in TWh once a season reaches one", () => {
        expect(energyScale(2.4e12)).toEqual({ unit: "TWh", divisor: 1e12 });
    });

    it("shows smaller rooms in GWh", () => {
        expect(energyScale(4e11)).toEqual({ unit: "GWh", divisor: 1e9 });
    });
});

describe("formatMegawatts", () => {
    it("shows power in MW below a GW, and in GW above", () => {
        expect(formatMegawatts(620e6)).toBe("620 MW");
        expect(formatMegawatts(1.234e9)).toBe("1.23 GW");
    });
});

describe("formatMegawattHours", () => {
    it("shows stored energy in MWh below a GWh, and in GWh above", () => {
        expect(formatMegawattHours(450e6)).toBe("450 MWh");
        expect(formatMegawattHours(2.5e9)).toBe("2.50 GWh");
    });
});

describe("riskLabel", () => {
    it("names each band of blackout risk", () => {
        expect(riskLabel("guaranteed")).toBe("Blackout guaranteed");
        expect(riskLabel("likely")).toBe("Blackout likely");
        expect(riskLabel("unlikely")).toBe("Blackout unlikely");
        expect(riskLabel("very_unlikely")).toBe("Blackout very unlikely");
    });
});
