/** React Query hooks for authentication-related data. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
    LoginRequest,
    SignupRequest,
    ChangePasswordRequest,
} from "@/types/auth";
import { authApi } from "@/lib/api/auth";
import { queryKeys } from "@/lib/query-client";
import { handleApiError } from "@/lib/error-utils";

/** Mutation hook for login. */
export function useLogin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (credentials: LoginRequest) => authApi.login(credentials),
        onSuccess: () => {
            // Invalidate user query to refetch user data
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
        },
        onError: (error) => {
            // Log error for debugging - consuming components handle UI display
            handleApiError(error, "Login failed");
        },
    });
}

/** Mutation hook for signup. */
export function useSignup() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: SignupRequest) => authApi.signup(data),
        onSuccess: () => {
            // Invalidate user query to refetch user data
            queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
        },
        onError: (error) => {
            // Log error for debugging - consuming components handle UI display
            handleApiError(error, "Sign-up failed");
        },
    });
}

/** Mutation hook for changing password. */
export function useChangePassword() {
    return useMutation({
        mutationFn: (data: ChangePasswordRequest) =>
            authApi.changePassword(data),
        onError: (error) => {
            // Log error for debugging - consuming components handle UI display
            handleApiError(error, "Failed to change password");
        },
    });
}

/** Mutation hook for logout. */
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
        onError: (error) => {
            // Log error for debugging - consuming components handle UI display
            handleApiError(error, "Failed to logout");
        },
    });
}
