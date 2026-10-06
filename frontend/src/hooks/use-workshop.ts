/**
 * Hooks for a Workshop Run (#995): entering it, following the session as the
 * moderator advances it, reading the facility catalog and fleet (#998), picking
 * facilities to buy in the Investment phase (#999), and setting prices in a
 * Trading period's price-setting window (#1002).
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import io from "socket.io-client";
import { toast } from "sonner";

import { workshopApi } from "@/lib/api/workshop";
import { ApiClientError } from "@/lib/api-client";
import { isErrorType } from "@/lib/error-utils";
import { resolveErrorMessage } from "@/lib/game-messages";
import { queryClient, queryKeys } from "@/lib/query-client";
import { phaseDeadline } from "@/lib/workshop-countdown";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopEntry = ApiSchema<"WorkshopEntryOut">;

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
export function useWorkshopSession() {
    return useQuery({
        queryKey: queryKeys.workshop.session,
        queryFn: workshopApi.getSession,
    });
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
 * every open page when the facilitator advances the session.
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
