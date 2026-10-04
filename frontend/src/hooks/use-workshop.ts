/**
 * Hooks for a Workshop Run (#995): entering it, and following the session as
 * the moderator advances it.
 */

import { useQuery } from "@tanstack/react-query";

import { workshopApi } from "@/lib/api/workshop";
import { ApiClientError } from "@/lib/api-client";
import { isErrorType } from "@/lib/error-utils";
import { queryKeys } from "@/lib/query-client";
import type { ApiSchema } from "@/types/api-helpers";

type WorkshopEntry = ApiSchema<"WorkshopEntryOut">;

// How often the session is re-read. A Workshop Run has no socket, so this is how the timeline
// learns that the moderator advanced it.
const SESSION_POLL_MS = 5000;

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
 * Where the session is, re-read every few seconds while a Workshop page is
 * open.
 */
export function useWorkshopSession() {
    return useQuery({
        queryKey: queryKeys.workshop.session,
        queryFn: workshopApi.getSession,
        refetchInterval: SESSION_POLL_MS,
    });
}
