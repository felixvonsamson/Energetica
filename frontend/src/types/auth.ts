/**
 * Type definitions for authentication-related API operations.
 *
 * These types correspond to backend schemas in energetica/schemas/auth.py
 */

import type { ApiRequestBody } from "@/types/api-helpers";

/**
 * Request body for POST /api/v1/auth/login
 *
 * Authenticates a user with username and password.
 */
export type LoginRequest = ApiRequestBody<"/api/v1/auth/login", "post">;

/**
 * Request body for POST /api/v1/auth/signup
 *
 * Creates a new user account with registration information.
 */
export type SignupRequest = ApiRequestBody<"/api/v1/auth/signup", "post">;

/**
 * Request body for POST /api/v1/auth/change-password
 *
 * Changes the user's password after verifying the old password.
 */
export type ChangePasswordRequest = ApiRequestBody<
    "/api/v1/auth/change-password",
    "post"
>;
