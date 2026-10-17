/**
 * Workshop Run API calls (#994, #995, #996, #998, #999, #1002, #1007, #1008,
 * #1009, #1011, #1012, #1014, #1018, #1190). Served only by a Workshop Run's
 * backend.
 */

import type { ApiResponse, ApiSchema } from "@/types/api-helpers";
import { apiClient } from "@energetica/core/api-client";

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
     * How long each timed phase is open when it starts (#996). Facilitator
     * only.
     */
    getTimers: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/timers", "get">>(
            "/workshop/timers",
        ),

    /**
     * Replace the phase timers (#1018). They apply to the next phase that
     * opens. Facilitator only. Returns the timers after the change.
     */
    setTimers: (timers: ApiSchema<"PhaseTimers">) =>
        apiClient.put<ApiResponse<"/api/v1/workshop/timers", "put">>(
            "/workshop/timers",
            timers,
        ),

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
     * How far each technology is from unlocking its upgrade, and what has
     * unlocked so far (#1011). Facilitator only.
     */
    getUnlocks: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/unlocks", "get">>(
            "/workshop/unlocks",
        ),

    /**
     * The events the facilitator can plan, without their headlines, and the
     * events that fired (#1012). Facilitator only.
     */
    getEvents: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/events", "get">>(
            "/workshop/events",
        ),

    /**
     * Every Round's plan: its levers and planned events, whether it is locked,
     * and what became of each event (#1190). Facilitator only.
     */
    getPlans: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/plans", "get">>(
            "/workshop/plans",
        ),

    /**
     * Change some of a Round's levers (#1190). Each lever that changed also
     * changes in every later Round. Facilitator only. Returns every Round's
     * plan after the change.
     */
    changeLevers: ({
        round,
        changes,
    }: {
        round: number;
        changes: ApiSchema<"LeverChanges">;
    }) =>
        apiClient.patch<
            ApiResponse<"/api/v1/workshop/plans/{round_number}/levers", "patch">
        >(`/workshop/plans/${round}/levers`, changes),

    /**
     * Plan an event for a Round, and for a seasonal event a season, in place of
     * the one of its category planned for the same boundary (#1190).
     */
    planEvent: ({
        round,
        planned,
    }: {
        round: number;
        planned: ApiSchema<"PlannedEvent">;
    }) =>
        apiClient.put<
            ApiResponse<"/api/v1/workshop/plans/{round_number}/events", "put">
        >(`/workshop/plans/${round}/events`, planned),

    /**
     * Drop an event planned for a Round's season, or for the Round if `season`
     * is null (#1190).
     */
    unplanEvent: ({
        round,
        eventId,
        season,
    }: {
        round: number;
        eventId: string;
        season: Season | null;
    }) =>
        apiClient.delete<
            ApiResponse<
                "/api/v1/workshop/plans/{round_number}/events/{event_id}",
                "delete"
            >
        >(
            `/workshop/plans/${round}/events/${encodeURIComponent(eventId)}${
                season ? `?season=${season}` : ""
            }`,
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

    /**
     * The Recap that closes a Round (#1013): what happened in it, and what the
     * next Round holds. Refused until the Recap opens.
     */
    getRecap: (round: number) =>
        apiClient.get<
            ApiResponse<"/api/v1/workshop/rounds/{round_number}/recap", "get">
        >(`/workshop/rounds/${round}/recap`),

    /**
     * Every player's final score, highest first (#1017). Refused until the
     * session is over.
     */
    getScoreboard: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/scoreboard", "get">>(
            "/workshop/scoreboard",
        ),

    /**
     * The current Round's carbon tax vote (#1014): whether it holds one, the
     * visitor's ballot, and once the Investment phase is over, whether it
     * passed.
     */
    getVote: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/vote", "get">>(
            "/workshop/vote",
        ),

    /**
     * Cast the visitor's ballot in the current Round's vote, in place of any
     * they cast before. Players only, while the Investment phase is open.
     */
    castBallot: (ballot: ApiSchema<"WorkshopBallotIn">["ballot"]) =>
        apiClient.put<ApiResponse<"/api/v1/workshop/vote/ballot", "put">>(
            "/workshop/vote/ballot",
            { ballot },
        ),

    /**
     * The visitor's loan (#1225): its terms, whether they can take it now, and
     * once taken, its payments. Players only.
     */
    getLoan: () =>
        apiClient.get<ApiResponse<"/api/v1/workshop/loan", "get">>(
            "/workshop/loan",
        ),

    /**
     * Take the loan, adding its amount to the visitor's cash straight away.
     * Only while the Investment phase is open, in any Round but the last, and
     * once per session.
     */
    takeLoan: () =>
        apiClient.post<ApiResponse<"/api/v1/workshop/loan", "post">>(
            "/workshop/loan",
        ),

    /**
     * Cancel the loan taken in this Investment phase. Only while it is open,
     * and only if the selection still fits the visitor's cash without it.
     */
    cancelLoan: () =>
        apiClient.delete<ApiResponse<"/api/v1/workshop/loan", "delete">>(
            "/workshop/loan",
        ),

    /** A settled Trading period's simulated days, weeks and settlement points. */
    getPeriod: (round: number, season: Season) =>
        apiClient.get<
            ApiResponse<
                "/api/v1/workshop/periods/{round_number}/{season}",
                "get"
            >
        >(`/workshop/periods/${round}/${season}`),

    /**
     * Every settlement point of one simulated week of a settled Trading period.
     * `week` is the week's position in the period, from 0.
     */
    getPeriodWeek: (round: number, season: Season, week: number) =>
        apiClient.get<
            ApiResponse<
                "/api/v1/workshop/periods/{round_number}/{season}/weeks/{week}",
                "get"
            >
        >(`/workshop/periods/${round}/${season}/weeks/${week}`),

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
