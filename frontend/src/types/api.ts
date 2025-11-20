/**
 * TypeScript types for API responses and requests.
 * These should eventually be auto-generated from OpenAPI schema.
 */

export type UserRole = "player" | "admin";

export interface User {
    id: number;
    username: string;
    role: UserRole;
    player_id: number | null;
    is_settled: boolean;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface SignupRequest {
    username: string;
    password: string;
}

export interface ChangePasswordRequest {
    old_password: string;
    new_password: string;
}

export interface ApiResponse<T = unknown> {
    response?: string;
    data?: T;
}

export interface ApiError {
    detail: string;
}

// Player types
export interface Player {
    id: number;
    username: string;
}

export interface Money {
    money: number;
}

// Common response types
export type SuccessResponse = {
    response: "success";
};
