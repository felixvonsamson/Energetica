/**
 * Authentication-related API calls.
 */

import { apiClient } from "./api-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

export const authApi = {
    /**
     * Get current authenticated user.
     */
    me: () => apiClient.get<ApiResponse<"/api/v1/auth/me", "get">>("/auth/me"),

    /**
     * Login with username and password.
     */
    login: (credentials: ApiRequestBody<"/api/v1/auth/login", "post">) =>
        apiClient.post<ApiResponse<"/api/v1/auth/login", "post">>(
            "/auth/login",
            credentials,
        ),

    /**
     * Sign up new user.
     */
    signup: (data: ApiRequestBody<"/api/v1/auth/signup", "post">) =>
        apiClient.post<ApiResponse<"/api/v1/auth/signup", "post">>(
            "/auth/signup",
            data,
        ),

    /**
     * Change password for current user.
     */
    changePassword: (
        data: ApiRequestBody<"/api/v1/auth/change-password", "post">,
    ) =>
        apiClient.post<ApiResponse<"/api/v1/auth/change-password", "post">>(
            "/auth/change-password",
            data,
        ),

    /**
     * Logout (clears session cookie).
     */
    logout: () => {
        // Redirect to logout endpoint which clears the cookie
        window.location.href = "/logout";
    },
};
