/**
 * Workshop Run API calls (#994, #995, #996, #998). Served only by a Workshop
 * Run's backend.
 */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api-helpers";

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
};
