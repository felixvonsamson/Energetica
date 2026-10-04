/**
 * Hooks for a Workshop Run (#995): entering it, and following the session as
 * the moderator advances it.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import io from "socket.io-client";

import { workshopApi } from "@/lib/api/workshop";
import { ApiClientError } from "@/lib/api-client";
import { isErrorType } from "@/lib/error-utils";
import { queryClient, queryKeys } from "@/lib/query-client";
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
