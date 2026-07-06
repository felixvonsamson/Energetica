/**
 * Authentication-related API calls.
 *
 * `authApi` is shared across bundles. After the lobby cutover (ADR-0002/0003)
 * the credential calls (`login`, `signup`, `logout`, `changePassword`) are
 * served by the **lobby** backend and are used only by the lobby bundle
 * (`hooks/use-lobby.ts`); the instance app calls only `me`, its entry gate that
 * validates the shared SSO cookie and provisions the local user. The paths are
 * carried in the generated types because the schema generator merges the lobby
 * app's routes (scripts/ generate_openapi_schema.py).
 */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

export const authApi = {
    /** Get current authenticated user (the instance entry gate). */
    me: () => apiClient.get<ApiResponse<"/api/v1/auth/me", "get">>("/auth/me"),

    /** Login with username and password (lobby backend). */
    login: (credentials: ApiRequestBody<"/api/v1/auth/login", "post">) =>
        apiClient.post<ApiResponse<"/api/v1/auth/login", "post">>(
            "/auth/login",
            credentials,
        ),

    /** Sign up new account (lobby backend). */
    signup: (data: ApiRequestBody<"/api/v1/auth/signup", "post">) =>
        apiClient.post<ApiResponse<"/api/v1/auth/signup", "post">>(
            "/auth/signup",
            data,
        ),

    /** Change password for current account (lobby backend). */
    changePassword: (
        data: ApiRequestBody<"/api/v1/auth/change-password", "post">,
    ) =>
        apiClient.post<ApiResponse<"/api/v1/auth/change-password", "post">>(
            "/auth/change-password",
            data,
        ),

    /** Logout — clears the parent-domain session cookie (lobby backend). */
    logout: () =>
        apiClient.post<ApiResponse<"/api/v1/auth/logout", "post">>(
            "/auth/logout",
        ),
};
