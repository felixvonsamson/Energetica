/**
 * Hooks for a Workshop Run (#995): entering it, following the session as the
 * facilitator advances it, reading the facility catalog and fleet (#998),
 * picking facilities to buy in the Investment phase (#999), setting prices in a
 * Trading period's price-setting window (#1002), reviewing a settled Trading
 * period (#1007), voting on a carbon tax (#1014), and following technology
 * unlocks and planning each Round's levers, events and phase timers as the
 * facilitator (#1011, #1012, #1018, #1190), sending players to the page they
 * need when a phase starts or ends (#1251), reading the control room (#1289),
 * reading each player's team (#1384), and sending feedback on the game once it
 * is over.
 */

import {
    keepPreviousData,
    useIsMutating,
    useMutation,
    useQuery,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";
import { toast } from "sonner";

import { workshopApi } from "@/lib/api/workshop";
import { isErrorType } from "@/lib/error-utils";
import {
    formatLeverChangeError,
    resolveErrorMessage,
} from "@/lib/game-messages";
import { queryClient, queryKeys } from "@/lib/query-client";
import { phaseDeadline } from "@/lib/workshop-countdown";
import { phaseRedirect, type SessionPhase } from "@/lib/workshop-redirect";
import { withSettlementProgress } from "@/lib/workshop-settlement";
import { withBallot } from "@/lib/workshop-vote";
import type { ApiSchema } from "@/types/api-helpers";
import { ApiClientError } from "@energetica/core/api-client";

type WorkshopEntry = ApiSchema<"WorkshopEntryOut">;
type WorkshopSession = ApiSchema<"WorkshopSessionOut">;
type WorkshopSettlement = ApiSchema<"WorkshopSettlementOut">;
type Season = ApiSchema<"TradingPeriod">["season"];

/** The server's `invalidate` message: the query keys a page should re-read. */
interface InvalidateMessage {
    queries: (readonly unknown[])[];
}

/**
 * Enter the Run, or `null` when the visitor may not: they have no session
 * (401), or this private Run has not admitted their account (403), the same two
 * cases `fetchCurrentUser` reads as `null` in the persistent world.
 */
async function enterWorkshop(): Promise<WorkshopEntry | null> {
    try {
        return await workshopApi.enter();
    } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) return null;
        if (isErrorType(err, "INSTANCE_ACCESS_DENIED")) return null;
        throw err;
    }
}

/**
 * The visitor's entry into the Run: their role, and their player if they play.
 *
 * Entering is a POST because it places a player into the Network, but it is
 * safe to repeat (the same player comes back), so it is read like `/auth/me`:
 * once, and again only when invalidated.
 */
export function useWorkshopEntry({ enabled = true } = {}) {
    return useQuery({
        queryKey: queryKeys.workshop.entry,
        queryFn: enterWorkshop,
        enabled,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
    });
}

/**
 * Where the session is. It is re-read when the server says it changed, through
 * the socket {@link useWorkshopSocket} opens.
 */
export function useWorkshopSession({
    enabled = true,
    refetchInterval,
}: { enabled?: boolean; refetchInterval?: number } = {}) {
    return useQuery({
        queryKey: queryKeys.workshop.session,
        queryFn: workshopApi.getSession,
        enabled,
        refetchInterval,
    });
}

/**
 * Each player's team in a Run with teams (#1384), and the current player's
 * teammates. Without teams, or for the facilitator, every team is `null` and
 * there are no teammates.
 */
export function useWorkshopTeams() {
    const { data: entry } = useWorkshopEntry();
    const { data: session } = useWorkshopSession();
    const players = session?.players;
    const me = entry?.player ?? null;

    return useMemo(() => {
        const teams = new Map(
            (players ?? []).map((player) => [player.account_id, player.team]),
        );
        const myTeam = me?.team ?? null;
        const teammateIds =
            myTeam === null
                ? []
                : (players ?? [])
                      .filter(
                          (player) =>
                              player.team === myTeam &&
                              player.account_id !== me?.account_id,
                      )
                      .map((player) => player.account_id);
        return {
            teamOf: (accountId: number): string | null =>
                teams.get(accountId) ?? null,
            teammateIds,
        };
    }, [players, me]);
}

/**
 * The facilities players can see and buy now. They only change when the session
 * unlocks one, so the list is not re-read on its own. It is re-read whenever
 * the session changes, since its query key sits under the session's.
 */
export function useWorkshopFacilities() {
    return useQuery({
        queryKey: queryKeys.workshop.facilities,
        queryFn: workshopApi.getFacilities,
        staleTime: Infinity,
    });
}

/** The facilities the visitor owns, with how long each has left. */
export function useWorkshopFleet() {
    return useQuery({
        queryKey: queryKeys.workshop.fleet,
        queryFn: workshopApi.getFleet,
    });
}

/**
 * Whether the Investment phase is open, so the visitor can change their
 * selection. It closes when its countdown reaches zero, without waiting for the
 * server to say so.
 */
export function useInvestmentOpen(): boolean {
    return usePhaseOpen("investment");
}

/**
 * Whether a Trading period's price-setting window is open, so the visitor can
 * change their prices. Like {@link useInvestmentOpen}, it closes when its
 * countdown reaches zero.
 */
export function usePriceSettingOpen(): boolean {
    return usePhaseOpen("trading_period");
}

/** Whether the session is at a checkpoint of `kind` and its countdown runs. */
function usePhaseOpen(kind: "investment" | "trading_period"): boolean {
    const { data: session, dataUpdatedAt } = useWorkshopSession();
    const deadline =
        session?.checkpoint.kind === kind && session.phase_timer
            ? phaseDeadline(session.phase_timer, dataUpdatedAt)
            : null;
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (deadline === null) return;
        // Re-render once the deadline passes.
        const id = setTimeout(
            () => setNow(Date.now()),
            Math.max(deadline - Date.now(), 0),
        );
        return () => clearTimeout(id);
    }, [deadline]);

    // `now` stands still while nothing is timed, so it can be older than the
    // answer. The answer's arrival is a floor for the current time.
    return deadline !== null && Math.max(now, dataUpdatedAt) < deadline;
}

/**
 * Send a player to the page they need when a phase starts or ends
 * ({@link phaseRedirect}), and open the price panel through `openPricePanel`
 * when a price-setting window starts. It acts even while the player is busy,
 * such as typing a fuel order: the phase is over, so their time is up anyway.
 * The facilitator is never redirected.
 */
export function usePhaseRedirects(openPricePanel: () => void) {
    const { data: session } = useWorkshopSession();
    const { data: entry } = useWorkshopEntry();
    const priceSettingOpen = usePriceSettingOpen();
    const navigate = useNavigate();
    const previous = useRef<SessionPhase | null>(null);
    const checkpoint = session?.checkpoint;

    useEffect(() => {
        if (!checkpoint) return;
        const current = { checkpoint, priceSettingOpen };
        const redirect = phaseRedirect(previous.current, current);
        previous.current = current;
        if (!redirect || entry?.role !== "player") return;
        void navigate(redirect.page);
        if (redirect.kind === "open_price_panel") openPricePanel();
    }, [checkpoint, priceSettingOpen, entry?.role, navigate, openPricePanel]);
}

/**
 * The facilities the visitor has picked to buy when the Investment phase
 * closes, their total cost, and the visitor's money. Players only.
 */
export function useWorkshopSelection() {
    return useQuery({
        queryKey: queryKeys.workshop.selection,
        queryFn: workshopApi.getSelection,
    });
}

/** Add one facility to the visitor's selection. */
export function useAddToSelection() {
    return useSelectionChange(workshopApi.addToSelection);
}

/** Take one copy of a facility out of the visitor's selection. */
export function useRemoveFromSelection() {
    return useSelectionChange(workshopApi.removeFromSelection);
}

/** Shared by adding and removing, to count the selection changes in flight. */
const SELECTION_CHANGE = ["workshop", "selection-change"] as const;

/**
 * Whether two selection changes have been in flight at once since the last time
 * none were.
 */
let selectionChangesOverlapped = false;

/** How many selection changes are in flight, counting the one calling this. */
function selectionChangesInFlight(): number {
    // A mutation counts as in flight from before its `onMutate` until after its
    // `onSettled`.
    return queryClient.isMutating({ mutationKey: SELECTION_CHANGE });
}

/**
 * A change to the selection. Never retried: a retry after a lost response would
 * add or remove a second copy.
 *
 * The response is the selection after the change, so it replaces the cached
 * selection. Changes made in quick succession can be handled and answered in
 * any order, though, so their answers are not trusted: the selection is re-read
 * once the last of them is done.
 */
function useSelectionChange(
    change: (
        facility: ApiSchema<"FacilityId">,
    ) => Promise<ApiSchema<"WorkshopSelectionOut">>,
) {
    return useMutation({
        mutationKey: SELECTION_CHANGE,
        mutationFn: change,
        retry: false,
        onMutate: () => {
            if (selectionChangesInFlight() > 1) {
                selectionChangesOverlapped = true;
            }
        },
        onSuccess: (selection) => {
            if (!selectionChangesOverlapped) {
                queryClient.setQueryData(
                    queryKeys.workshop.selection,
                    selection,
                );
            }
        },
        onSettled: () => {
            if (selectionChangesInFlight() > 1 || !selectionChangesOverlapped) {
                return;
            }
            selectionChangesOverlapped = false;
            void queryClient.invalidateQueries({
                queryKey: queryKeys.workshop.selection,
            });
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error));
            // The page's view of the session or the selection is out of date.
            void queryClient.invalidateQueries({
                queryKey: queryKeys.workshop.session,
            });
        },
    });
}

/**
 * The visitor's loan (#1225): its terms, whether they can take it now, and once
 * taken, its payments. Players only.
 */
export function useWorkshopLoan({ enabled = true } = {}) {
    return useQuery({
        queryKey: queryKeys.workshop.loan,
        queryFn: workshopApi.getLoan,
        enabled,
    });
}

/** Take the loan. */
export function useTakeLoan() {
    return useLoanChange(workshopApi.takeLoan);
}

/** Cancel the loan taken in this Investment phase. */
export function useCancelLoan() {
    return useLoanChange(workshopApi.cancelLoan);
}

/**
 * Taking or cancelling the loan. Never retried: a retry after a lost response
 * would be refused. Both change the visitor's cash, which the selection shows,
 * and the loan lines on the balance sheet, so both are read again too.
 */
function useLoanChange(change: () => Promise<ApiSchema<"WorkshopLoanOut">>) {
    return useMutation({
        mutationFn: change,
        retry: false,
        scope: { id: "workshop-loan" },
        onSuccess: (loan) => {
            queryClient.setQueryData(queryKeys.workshop.loan, loan);
        },
        onSettled: () =>
            Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.workshop.selection,
                }),
                queryClient.invalidateQueries({
                    queryKey: queryKeys.workshop.balanceSheets,
                }),
            ]),
        onError: (error) => {
            toast.error(resolveErrorMessage(error));
            // The page's view of the session or the loan is out of date.
            void queryClient.invalidateQueries({
                queryKey: queryKeys.workshop.session,
            });
        },
    });
}

/** The prices the visitor offers their facilities' power at. Players only. */
export function useWorkshopPrices() {
    return useQuery({
        queryKey: queryKeys.workshop.prices,
        queryFn: workshopApi.getPrices,
    });
}

/**
 * Set the visitor's `side` price for `facility`. The new price shows straight
 * away, and goes back if the server refuses it.
 *
 * Each field gets its own hook, and its changes are sent one at a time, so an
 * older price never lands after a newer one. A response carries every price,
 * but only this field's is taken from it: another field's may have changed
 * since the request left.
 */
export function useSetPrice(
    facility: ApiSchema<"FacilityId">,
    side: "sell" | "buy",
) {
    return useMutation({
        mutationFn: (price: number) =>
            workshopApi.setPrice({ facility, side, price }),
        // Safe to repeat: it sets the value outright.
        retry: 1,
        scope: { id: `workshop-price-${facility}-${side}` },
        onMutate: (price) => {
            queryClient.setQueryData(
                queryKeys.workshop.prices,
                (prices: ApiSchema<"WorkshopPricesOut"> | undefined) =>
                    prices && withPrice(prices, facility, side, price),
            );
        },
        onSuccess: (answer) => {
            const price = answer[side][facility];
            if (price === undefined) return;
            queryClient.setQueryData(
                queryKeys.workshop.prices,
                (prices: ApiSchema<"WorkshopPricesOut"> | undefined) =>
                    prices && withPrice(prices, facility, side, price),
            );
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error));
            // Undo the price shown, and re-read whether the window is open.
            void queryClient.invalidateQueries({
                queryKey: queryKeys.workshop.session,
            });
        },
    });
}

/**
 * The fuel the visitor's facilities burn: this season's prices, their stock,
 * and what they buy. Players only.
 */
export function useWorkshopFuel() {
    return useQuery({
        queryKey: queryKeys.workshop.fuel,
        queryFn: workshopApi.getFuel,
    });
}

/**
 * How far each technology is from unlocking its upgrade (#1011). Facilitator
 * only. Re-read whenever the session changes, so it follows each purchase.
 */
export function useWorkshopUnlocks() {
    return useQuery({
        queryKey: queryKeys.workshop.unlocks,
        queryFn: workshopApi.getUnlocks,
    });
}

/**
 * The events the facilitator can plan, and the events that fired (#1012).
 * Facilitator only. Re-read whenever the session changes.
 */
export function useWorkshopEvents() {
    return useQuery({
        queryKey: queryKeys.workshop.events,
        queryFn: workshopApi.getEvents,
    });
}

/**
 * Every Round's plan, and which are locked (#1190). Facilitator only. Re-read
 * whenever the session changes, since a Recap locks the next Round.
 */
export function useWorkshopPlans() {
    return useQuery({
        queryKey: queryKeys.workshop.plans,
        queryFn: workshopApi.getPlans,
    });
}

/**
 * Shared by every change to a plan (planning or dropping an event, changing a
 * lever), to tell whether any change is in flight.
 */
const PLAN_CHANGE = ["workshop", "plan-change"] as const;

/**
 * Whether a plan change is in flight. The console waits for each to finish
 * before the next, so the answers cannot arrive out of order.
 */
export function usePlanChangePending(): boolean {
    return useIsMutating({ mutationKey: PLAN_CHANGE }) > 0;
}

/**
 * A change to a plan (#1190). Each answer is every Round's plan after the
 * change, so it replaces the cached plans at once. The plans are then read
 * again: an answer that arrives late, after an advance locked a Round, would
 * otherwise leave that Round looking editable. A refused change re-reads them
 * too, so a Round that locked meanwhile shows as locked.
 */
function usePlanChange<Variables>(
    change: (variables: Variables) => Promise<ApiSchema<"WorkshopPlansOut">>,
    errorMessage: (error: unknown) => string = resolveErrorMessage,
) {
    return useMutation({
        mutationKey: PLAN_CHANGE,
        mutationFn: change,
        // Never retried: if the server saved the change but its response was lost, a Recap can
        // lock the Round before a retry arrives, and the retry would report a lock for a change
        // that was made.
        retry: false,
        onSuccess: (plans) => {
            queryClient.setQueryData(queryKeys.workshop.plans, plans);
        },
        onError: (error) => toast.error(errorMessage(error)),
        onSettled: () =>
            queryClient.invalidateQueries({
                queryKey: queryKeys.workshop.plans,
            }),
    });
}

/** Add a Round after the last one (#1298). */
export function useAddRound() {
    return usePlanChange(workshopApi.addRound);
}

/** Plan an event for a Round (#1190). */
export function usePlanEvent() {
    return usePlanChange(workshopApi.planEvent);
}

/** Drop an event planned for a Round (#1190). */
export function useUnplanEvent() {
    return usePlanChange(workshopApi.unplanEvent);
}

/**
 * Change some of a Round's levers (#1190), such as whether it holds a carbon
 * tax vote (#1014). A refusal names the Round the change would leave invalid
 * (#1018).
 */
export function useChangeLevers() {
    return usePlanChange(workshopApi.changeLevers, formatLeverChangeError);
}

/**
 * The current Round's carbon tax vote (#1014): whether it holds one, the
 * visitor's ballot, and once the Investment phase is over, whether it passed.
 * Re-read whenever the session changes, so the result shows once the vote is
 * counted.
 */
export function useWorkshopVote() {
    return useQuery({
        queryKey: queryKeys.workshop.vote,
        queryFn: workshopApi.getVote,
    });
}

/**
 * Cast the visitor's ballot. Ballots are sent one at a time, so an older one
 * never lands after a newer one. Only the ballot is taken from each answer
 * ({@link withBallot}): an answer that arrives after the vote was counted must
 * not hide the result. The vote is then read again, which also replaces any
 * read that started before the ballot was cast.
 */
export function useCastBallot() {
    return useMutation({
        mutationFn: workshopApi.castBallot,
        // Safe to repeat: it sets the value outright.
        retry: 1,
        scope: { id: "workshop-ballot" },
        onSuccess: (answer) => {
            queryClient.setQueryData(
                queryKeys.workshop.vote,
                (current: ApiSchema<"WorkshopVoteOut"> | undefined) =>
                    withBallot(current, answer),
            );
        },
        onSettled: () =>
            queryClient.invalidateQueries({
                queryKey: queryKeys.workshop.vote,
            }),
        onError: (error) => {
            toast.error(resolveErrorMessage(error));
            // The page's view of the session or the vote is out of date.
            void queryClient.invalidateQueries({
                queryKey: queryKeys.workshop.session,
            });
        },
    });
}

/**
 * Set how much `fuel` the visitor buys, in kg. Like {@link useSetPrice}, the new
 * quantity shows straight away, changes are sent one at a time, and only this
 * fuel's order is taken from the answer, which is the quantity after the server
 * cut it down to fit the stockpile limit.
 */
export function useSetFuelOrder(fuel: ApiSchema<"Fuel">) {
    return useMutation({
        mutationFn: (quantity: number) =>
            workshopApi.setFuelOrder({ fuel, quantity }),
        // Safe to repeat: it sets the value outright.
        retry: 1,
        scope: { id: `workshop-fuel-${fuel}` },
        onMutate: (quantity) => {
            queryClient.setQueryData(
                queryKeys.workshop.fuel,
                (current: ApiSchema<"WorkshopFuelOut"> | undefined) =>
                    current && withFuelOrder(current, fuel, quantity),
            );
        },
        onSuccess: (answer) => {
            const order = answer.fuels.find(
                (line) => line.fuel === fuel,
            )?.order;
            if (order === undefined || order === null) return;
            queryClient.setQueryData(
                queryKeys.workshop.fuel,
                (current: ApiSchema<"WorkshopFuelOut"> | undefined) =>
                    current && withFuelOrder(current, fuel, order),
            );
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error));
            // Undo the quantity shown, and re-read whether the window is open.
            void queryClient.invalidateQueries({
                queryKey: queryKeys.workshop.session,
            });
        },
    });
}

function withFuelOrder(
    current: ApiSchema<"WorkshopFuelOut">,
    fuel: ApiSchema<"Fuel">,
    order: number,
): ApiSchema<"WorkshopFuelOut"> {
    return {
        ...current,
        fuels: current.fuels.map((line) =>
            line.fuel === fuel ? { ...line, order } : line,
        ),
    };
}

function withPrice(
    prices: ApiSchema<"WorkshopPricesOut">,
    facility: ApiSchema<"FacilityId">,
    side: "sell" | "buy",
    price: number,
): ApiSchema<"WorkshopPricesOut"> {
    return { ...prices, [side]: { ...prices[side], [facility]: price } };
}

/**
 * Connect to the Workshop Run's Socket.IO server while mounted (#1140), and
 * re-read the queries its `invalidate` messages name. The server sends one to
 * every open page when the facilitator advances the session. Its
 * `settlement_progress` messages update the session's simulation progress.
 *
 * Nothing is sent for changes made before the socket connected, or while it was
 * down, so the session is re-read every time it connects.
 */
export function useWorkshopSocket() {
    useEffect(() => {
        const socket = io();
        socket.on("invalidate", (message: InvalidateMessage) => {
            for (const queryKey of message.queries) {
                void queryClient.invalidateQueries({ queryKey });
            }
        });
        // Sent as the days go by while a Trading period is being simulated
        // (#1155). It carries the progress itself, so only the session's
        // `settlement` changes. Keeping the session's read time keeps the
        // phase countdown, which counts from it, where it was.
        socket.on("settlement_progress", (progress: WorkshopSettlement) => {
            const readAt = queryClient.getQueryState(
                queryKeys.workshop.session,
            )?.dataUpdatedAt;
            queryClient.setQueryData(
                queryKeys.workshop.session,
                (session: WorkshopSession | undefined) =>
                    withSettlementProgress(session, progress),
                { updatedAt: readAt },
            );
        });
        socket.on("connect", () => {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.workshop.session,
            });
        });
        return () => {
            socket.disconnect();
        };
    }, []);
}

/**
 * The facilitator's advance: moves the session to its next checkpoint. The
 * response is the session after the move, so it replaces the cached session
 * straight away instead of waiting for the server's message.
 */
export function useAdvanceSession() {
    return useMutation({
        mutationFn: workshopApi.advanceSession,
        // Never retried: if the server advanced but its response was lost, a retry would move the
        // whole room a second step, and an advance cannot be undone.
        retry: false,
        onSuccess: (session) => {
            queryClient.setQueryData(queryKeys.workshop.session, session);
        },
    });
}

/**
 * The facilitator's "+N minutes" on the running phase. Like an advance, it is
 * never retried, since a retry after a lost response would add the time twice.
 */
export function useExtendPhase() {
    return useMutation({
        mutationFn: workshopApi.extendPhase,
        retry: false,
        onSuccess: (session) => {
            queryClient.setQueryData(queryKeys.workshop.session, session);
        },
    });
}

/** How long each timed phase is open when it starts (#996). Facilitator only. */
export function useWorkshopTimers() {
    return useQuery({
        queryKey: queryKeys.workshop.timers,
        queryFn: workshopApi.getTimers,
    });
}

/**
 * Replace the phase timers (#1018). They apply to the next phase that opens, so
 * repeating the same change is harmless.
 */
export function useSetTimers() {
    return useMutation({
        mutationFn: workshopApi.setTimers,
        // Safe to repeat: it sets the value outright.
        retry: 1,
        onSuccess: (timers) => {
            queryClient.setQueryData(queryKeys.workshop.timers, timers);
        },
    });
}

/**
 * The player's balance sheet for a Round (#1008). Read again whenever the
 * session changes, so it fills in as the Round's seasons are settled.
 */
export function useWorkshopBalanceSheet(round: number) {
    return useQuery({
        queryKey: queryKeys.workshop.balanceSheet(round),
        queryFn: () => workshopApi.getBalanceSheet(round),
        retry: false,
    });
}

/**
 * The Recap that closes a Round (#1013). Refused until the Recap opens, and
 * read again whenever the session changes, so it appears as soon as it does.
 */
export function useWorkshopRecap(round: number) {
    return useQuery({
        queryKey: queryKeys.workshop.recap(round),
        queryFn: () => workshopApi.getRecap(round),
        retry: false,
    });
}

/**
 * Every player's score after the Rounds completed so far, highest first (#1017,
 * #1250). Read again whenever the session changes, so it follows each Recap as
 * it opens.
 */
export function useWorkshopScoreboard() {
    return useQuery({
        queryKey: queryKeys.workshop.scoreboard,
        queryFn: workshopApi.getScoreboard,
        retry: false,
    });
}

/**
 * Set each named team's bonus multiplier on its score. The facilitator's
 * scoreboard follows from the answer, and every other page re-reads it.
 */
export function useSetBonusMultipliers() {
    return useMutation({
        mutationFn: workshopApi.setBonusMultipliers,
        // Safe to repeat: it sets the values outright.
        retry: 1,
        onSuccess: (scoreboard) => {
            queryClient.setQueryData(queryKeys.workshop.scoreboard, scoreboard);
        },
    });
}

/**
 * The feedback the visitor sent on the game, or null if they have not sent any.
 * Players only.
 */
export function useWorkshopFeedback() {
    return useQuery({
        queryKey: queryKeys.workshop.feedback,
        queryFn: workshopApi.getFeedback,
    });
}

/** Send the visitor's feedback on the game, in place of any they sent before. */
export function useSendFeedback() {
    return useMutation({
        mutationFn: workshopApi.sendFeedback,
        onSuccess: (answer) => {
            queryClient.setQueryData(queryKeys.workshop.feedback, answer);
        },
        onError: (error) => {
            toast.error(resolveErrorMessage(error));
        },
    });
}

/**
 * Everything the control room shows (#1289). Read again whenever the session
 * changes, and whenever a player changes a price.
 */
export function useWorkshopControlRoom() {
    return useQuery({
        queryKey: queryKeys.workshop.controlRoom,
        queryFn: workshopApi.getControlRoom,
    });
}

/**
 * A settled Trading period's simulated days, weeks and settlement points. Fails
 * with a 404 until the period is settled, and is read again when the session
 * changes.
 */
export function useWorkshopPeriod(round: number, season: Season) {
    return useQuery({
        queryKey: queryKeys.workshop.period(round, season),
        queryFn: () => workshopApi.getPeriod(round, season),
        retry: false,
    });
}

/**
 * Every player's prices for a Trading period (#1299). Read again whenever a
 * player changes one, so it updates live while the price-setting window is
 * open.
 */
export function useMarketPrices(round: number, season: Season) {
    return useQuery({
        queryKey: queryKeys.workshop.marketPricesFor(round, season),
        queryFn: () => workshopApi.getMarketPrices(round, season),
        retry: false,
    });
}

/**
 * Every settlement point of one simulated week of a settled Trading period.
 * While another week loads, the last one stays on screen.
 */
export function useWorkshopPeriodWeek(
    round: number,
    season: Season,
    week: number,
    { enabled = true } = {},
) {
    return useQuery({
        queryKey: queryKeys.workshop.periodWeek(round, season, week),
        queryFn: () => workshopApi.getPeriodWeek(round, season, week),
        enabled,
        staleTime: Infinity,
        placeholderData: keepPreviousData,
    });
}

/**
 * The merit order at one settlement point of a settled Trading period. While
 * the next point loads, the last one stays on screen, so scrubbing does not
 * flicker.
 */
export function useWorkshopMeritOrder(
    round: number,
    season: Season,
    point: number | null,
) {
    return useQuery({
        queryKey: queryKeys.workshop.meritOrder(round, season, point ?? -1),
        queryFn: () => workshopApi.getMeritOrder(round, season, point ?? 0),
        enabled: point !== null,
        staleTime: Infinity,
        placeholderData: keepPreviousData,
    });
}
