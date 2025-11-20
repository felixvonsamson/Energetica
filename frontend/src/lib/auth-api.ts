/**
 * Authentication-related API calls.
 */

import { apiClient } from "./api-client";
import type {
    User,
    LoginRequest,
    SignupRequest,
    ChangePasswordRequest,
    SuccessResponse,
} from "@/types/api";

export const authApi = {
    /**
     * Get current authenticated user.
     */
    me: () => apiClient.get<User>("/auth/me"),

    /**
     * Login with username and password.
     */
    login: (credentials: LoginRequest) =>
        apiClient.post<SuccessResponse>("/auth/login", credentials),

    /**
     * Sign up new user.
     */
    signup: (data: SignupRequest) =>
        apiClient.post<SuccessResponse>("/auth/signup", data),

    /**
     * Change password for current user.
     */
    changePassword: (data: ChangePasswordRequest) =>
        apiClient.post<void>("/auth/change-password", data),

    /**
     * Logout (clears session cookie).
     */
    logout: () => {
        // Redirect to logout endpoint which clears the cookie
        window.location.href = "/logout";
    },
};
