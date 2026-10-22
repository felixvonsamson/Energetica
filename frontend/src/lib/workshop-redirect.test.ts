import { describe, expect, it } from "vitest";

import { phaseRedirect, type SessionPhase } from "./workshop-redirect";

const investment: SessionPhase = {
    checkpoint: { kind: "investment", round: 2 },
    priceSettingOpen: false,
};
const springOpen: SessionPhase = {
    checkpoint: { kind: "trading_period", round: 2, season: "spring" },
    priceSettingOpen: true,
};
const springClosed: SessionPhase = { ...springOpen, priceSettingOpen: false };
const summerOpen: SessionPhase = {
    checkpoint: { kind: "trading_period", round: 2, season: "summer" },
    priceSettingOpen: true,
};
const winterClosed: SessionPhase = {
    checkpoint: { kind: "trading_period", round: 2, season: "winter" },
    priceSettingOpen: false,
};
const recap: SessionPhase = {
    checkpoint: { kind: "recap", round: 2 },
    priceSettingOpen: false,
};

describe("phaseRedirect", () => {
    it("sends players to the facility catalog when the Investment phase starts", () => {
        expect(
            phaseRedirect(
                {
                    checkpoint: { kind: "recap", round: 1 },
                    priceSettingOpen: false,
                },
                investment,
            ),
        ).toEqual({
            kind: "navigate",
            page: { to: "/app/workshop/facilities" },
        });
        expect(
            phaseRedirect(
                {
                    checkpoint: { kind: "not_started" },
                    priceSettingOpen: false,
                },
                {
                    checkpoint: { kind: "investment", round: 1 },
                    priceSettingOpen: false,
                },
            ),
        ).toEqual({
            kind: "navigate",
            page: { to: "/app/workshop/facilities" },
        });
    });

    it("opens the price panel on the season's page when a price-setting window starts", () => {
        expect(phaseRedirect(investment, springOpen)).toEqual({
            kind: "open_price_panel",
            page: {
                to: "/app/workshop/round/$round/$season",
                params: { round: "2", season: "spring" },
            },
        });
        expect(phaseRedirect(springClosed, summerOpen)).toEqual({
            kind: "open_price_panel",
            page: {
                to: "/app/workshop/round/$round/$season",
                params: { round: "2", season: "summer" },
            },
        });
    });

    it("sends players to the season's charts when its price-setting window ends", () => {
        expect(phaseRedirect(springOpen, springClosed)).toEqual({
            kind: "navigate",
            page: {
                to: "/app/workshop/round/$round/$season",
                params: { round: "2", season: "spring" },
            },
        });
    });

    it("opens the Recap for every player when it is published", () => {
        expect(phaseRedirect(winterClosed, recap)).toEqual({
            kind: "navigate",
            page: {
                to: "/app/workshop/recap/$round",
                params: { round: "2" },
            },
        });
    });

    it("does nothing on the first look at the session, such as on page load", () => {
        expect(phaseRedirect(null, investment)).toBeNull();
        expect(phaseRedirect(null, springOpen)).toBeNull();
        expect(phaseRedirect(null, recap)).toBeNull();
    });

    it("does nothing while the phase stays the same, such as on reconnect", () => {
        expect(phaseRedirect(investment, investment)).toBeNull();
        expect(phaseRedirect(springOpen, springOpen)).toBeNull();
        expect(phaseRedirect(springClosed, springClosed)).toBeNull();
        expect(phaseRedirect(recap, recap)).toBeNull();
    });

    it("does nothing for the end of the Investment phase or the session", () => {
        expect(
            phaseRedirect(investment, {
                checkpoint: { kind: "investment", round: 2 },
                priceSettingOpen: false,
            }),
        ).toBeNull();
        expect(
            phaseRedirect(
                {
                    checkpoint: { kind: "recap", round: 3 },
                    priceSettingOpen: false,
                },
                { checkpoint: { kind: "finished" }, priceSettingOpen: false },
            ),
        ).toBeNull();
    });

    it("sends players to the charts for a Trading period first seen with its window closed", () => {
        expect(phaseRedirect(investment, springClosed)).toEqual({
            kind: "navigate",
            page: {
                to: "/app/workshop/round/$round/$season",
                params: { round: "2", season: "spring" },
            },
        });
    });

    it("follows the newest phase when the session moved on more than one step", () => {
        // The window closed and the next one opened between two reads.
        expect(phaseRedirect(springOpen, summerOpen)).toEqual({
            kind: "open_price_panel",
            page: {
                to: "/app/workshop/round/$round/$season",
                params: { round: "2", season: "summer" },
            },
        });
    });
});
