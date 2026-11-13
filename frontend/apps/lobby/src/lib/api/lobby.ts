/**
 * Lobby API calls, typed against the lobby backend's own generated schema
 * (`@/types/api.generated`), so they can only reach routes the lobby serves.
 *
 * Every instance also serves `my-runs`; the instance bundle has its own copy of
 * that call. The credential calls (`lobbyAuthApi`) exist only here: instances
 * retired those endpoints at the cutover (ADR-0002/0003).
 */

import { apiClient } from "@energetica/core/api-client";

import type { ApiRequestBody, ApiResponse } from "@/types/api-helpers";

export type MyRunsResponse = ApiResponse<"/api/v1/lobby/my-runs", "get">;
export type MyRun = MyRunsResponse["runs"][number];
export type FacilitatedRun = MyRunsResponse["facilitated_runs"][number];

export const lobbyApi = {
    /**
     * The authenticated account's joined runs (settled or not), most recently
     * joined first.
     */
    myRuns: () => apiClient.get<MyRunsResponse>("/lobby/my-runs"),

    /**
     * The picker's explicit two-click join (#1030): record that the
     * authenticated account has joined the public run `slug`. Idempotent. 403s
     * for a private run (join stays instance-owned for those — the
     * roster/join-link flow) and for this run's own facilitator.
     */
    joinRun: (slug: string) =>
        apiClient.post<ApiResponse<"/api/v1/lobby/runs/{slug}/join", "post">>(
            `/lobby/runs/${encodeURIComponent(slug)}/join`,
        ),
};

/** Credential calls against the lobby backend. Lobby bundle only. */
export const lobbyAuthApi = {
    /** Log in with username + password; mints the parent-domain SSO cookie. */
    login: (credentials: ApiRequestBody<"/api/v1/auth/login", "post">) =>
        apiClient.post<ApiResponse<"/api/v1/auth/login", "post">>(
            "/auth/login",
            credentials,
        ),

    /** Create a server-wide account (account-only, ADR-0003) and auto-log-in. */
    signup: (data: ApiRequestBody<"/api/v1/auth/signup", "post">) =>
        apiClient.post<ApiResponse<"/api/v1/auth/signup", "post">>(
            "/auth/signup",
            data,
        ),

    // Change-password is deliberately absent here: the account page posts it as a
    // native <form> (frontend/src/routes-lobby/account.tsx) rather than via this fetch
    // client, so Safari/Apple Passwords sees the submit navigation and offers to update
    // the saved credential (issue #849). There is no JSON change-password endpoint.

    /** Global logout — clears the single parent-domain session cookie. */
    logout: () =>
        apiClient.post<ApiResponse<"/api/v1/auth/logout", "post">>(
            "/auth/logout",
        ),
};
