/**
 * Workshop Run API calls (#994, #995, #996, #998, #999, #1002, #1007, #1008,
 * #1009). Served only by a Workshop Run's backend.
 */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse, ApiSchema } from "@/types/api-helpers";

type FacilityId = ApiSchema<"FacilityId">;
type Fuel = ApiSchema<"Fuel">;
type PriceSide = "sell" | "buy";
type Season = ApiSchema<"TradingPeriod">["season"];

export const workshopApi = {
    /**
     * Enter the Run: the Workshop's entry gate, in place of `/auth/me`. Places
     * a player into the shared Network the first time and returns the same
     * player after that. Returns the role either way.
     */
    enter: () =>
        apiClient.post<ApiResponse<"/api/v1/workshop/enter", "post">>(
            "/workshop/enter",
        ),

    /**
     * Move the session to its next checkpoint. Facilitator only. Returns the
     * session after the move.
     */
    advanceSession: () =>
        apiClient.post<ApiResponse<"/api/v1/workshop/session/advance", "post">>(
            "/workshop/session/advance",
        ),

    /**
     * Give the running phase `minutes` more time. Facilitator only. Returns the
     * session after the change.
     */
    extendPhase: (minutes: number) =>
        apiClient.post<
            ApiResponse<"/api/v1/workshop/session/phase/extend", "post">
        >("/workshop/session/phase/extend", { minutes }),

    /**
     * Where the session is: its checkpoint, its phase countdown, Round count
     * and players.
     */
    getSession: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/session", "get">>(
            "/workshop/session",
        ),

    /** The facilities players can see and buy now, in catalog order. */
    getFacilities: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/facilities", "get">>(
            "/workshop/facilities",
        ),

    /**
     * The facilities the visitor owns, in the order they were bought, with how
     * long each has left. Empty for a facilitator.
     */
    getFleet: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/fleet", "get">>(
            "/workshop/fleet",
        ),

    /**
     * The facilities the visitor has picked in the open Investment phase, what
     * they cost together, and the visitor's money. Players only.
     */
    getSelection: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/selection", "get">>(
            "/workshop/selection",
        ),

    /**
     * Add one facility to the visitor's selection. Only while the Investment
     * phase is open, and only if the visitor can pay for the whole selection.
     */
    addToSelection: (facility: FacilityId) =>
        apiClient.post<ApiResponse<"/api/v1/workshop/selection", "post">>(
            "/workshop/selection",
            { facility },
        ),

    /** Take one copy of a facility out of the visitor's selection. */
    removeFromSelection: (facility: FacilityId) =>
        apiClient.delete<
            ApiResponse<"/api/v1/workshop/selection/{facility}", "delete">
        >(`/workshop/selection/${facility}`),

    /**
     * The prices the visitor offers their facilities' power at, per MWh, and
     * the lowest price they can set. Players only.
     */
    getPrices: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/prices", "get">>(
            "/workshop/prices",
        ),

    /**
     * Set one of the visitor's prices: what a facility type sells at, or for
     * storage, what it buys at to charge. Only while a Trading period's
     * price-setting window is open. Returns all the visitor's prices.
     */
    setPrice: ({
        facility,
        side,
        price,
    }: {
        facility: FacilityId;
        side: PriceSide;
        price: number;
    }) =>
        apiClient.put<
            ApiResponse<"/api/v1/workshop/prices/{facility}/{side}", "put">
        >(`/workshop/prices/${facility}/${side}`, { price }),

    /**
     * The prices each completed Trading period ran at for the visitor, oldest
     * first.
     */
    getLockedPrices: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/prices/locked", "get">>(
            "/workshop/prices/locked",
        ),

    /**
     * The fuel the visitor's facilities burn: this season's prices, their
     * stock, and under manual procurement what they buy when the price-setting
     * window closes. Players only.
     */
    getFuel: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/fuel", "get">>(
            "/workshop/fuel",
        ),

    /**
     * Set how much of a fuel the visitor buys when the price-setting window
     * closes, in kg. The server cuts it down to fit the stockpile limit.
     * Returns all the visitor's fuel.
     */
    setFuelOrder: ({ fuel, quantity }: { fuel: Fuel; quantity: number }) =>
        apiClient.put<ApiResponse<"/api/v1/workshop/fuel/{fuel}", "put">>(
            `/workshop/fuel/${fuel}`,
            { quantity },
        ),

    /**
     * The visitor's balance sheet for a Round (#1008): what each settled season
     * earned and cost, and the Round's investments and net profit so far.
     * Players only.
     */
    getBalanceSheet: (round: number) =>
        apiClient.get<
            ApiResponse<
                "/api/v1/workshop/rounds/{round_number}/balance-sheet",
                "get"
            >
        >(`/workshop/rounds/${round}/balance-sheet`),

    /** A settled Trading period's simulated days and settlement points. */
    getPeriod: (round: number, season: Season) =>
        apiClient.get<
            ApiResponse<
                "/api/v1/workshop/periods/{round_number}/{season}",
                "get"
            >
        >(`/workshop/periods/${round}/${season}`),

    /**
     * Every settlement point of one simulated day of a settled Trading period.
     * `day` is the day's position in the period's days.
     */
    getPeriodDay: (round: number, season: Season, day: number) =>
        apiClient.get<
            ApiResponse<
                "/api/v1/workshop/periods/{round_number}/{season}/days/{day}",
                "get"
            >
        >(`/workshop/periods/${round}/${season}/days/${day}`),

    /**
     * The merit order at one settlement point of a settled Trading period,
     * counted from the period's first point.
     */
    getMeritOrder: (round: number, season: Season, point: number) =>
        apiClient.get<
            ApiResponse<
                "/api/v1/workshop/periods/{round_number}/{season}/points/{point}/merit-order",
                "get"
            >
        >(`/workshop/periods/${round}/${season}/points/${point}/merit-order`),
};
