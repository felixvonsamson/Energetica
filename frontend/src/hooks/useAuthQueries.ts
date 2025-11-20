/**
 * React Query hooks for authentication-related data.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/auth-api";
import { queryKeys } from "@/lib/query-client";
import type { ApiRequestBody } from "@/types/api-helpers";

type LoginRequest = ApiRequestBody<"/api/v1/auth/login", "post">;
type SignupRequest = ApiRequestBody<"/api/v1/auth/signup", "post">;
type ChangePasswordRequest = ApiRequestBody<
    "/api/v1/auth/change-password",
    "post"
>;

/**
 * Mutation hook for login.
 */
export function useLogin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (credentials: LoginRequest) => authApi.login(credentials),
        onSuccess: () => {
            // Invalidate user query to refetch user data
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
        },
    });
}

/**
 * Mutation hook for signup.
 */
export function useSignup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: SignupRequest) => authApi.signup(data),
        onSuccess: () => {
            // Invalidate user query to refetch user data
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
        },
    });
}

/**
 * Mutation hook for changing password.
 */
export function useChangePassword() {
    return useMutation({
        mutationFn: (data: ChangePasswordRequest) =>
            authApi.changePassword(data),
    });
}

/**
 * Mutation hook for logout.
 */
export function useLogout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => {
            authApi.logout();
            return Promise.resolve();
        },
        onSuccess: () => {
            // Clear all queries on logout
            queryClient.clear();
        },
    });
}
