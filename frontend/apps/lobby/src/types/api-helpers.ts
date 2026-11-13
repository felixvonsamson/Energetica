/**
 * Helper types and utilities for working with generated API types. This file
 * provides convenient type extractors for the OpenAPI-generated types.
 */

import type { paths, components } from "@/types/api.generated";

// Re-export for use in other files
export type { paths, components };

/**
 * Extract the response type for a specific API endpoint and method.
 *
 * @example
 *     type MyRuns = ApiResponse<"/api/v1/lobby/my-runs", "get">;
 *     // Returns the 200 response type for GET /api/v1/lobby/my-runs
 */
export type ApiResponse<
    Path extends keyof paths,
    Method extends keyof paths[Path],
> = paths[Path][Method] extends { responses: { 200: { content: infer C } } }
    ? C extends { "application/json": infer T }
        ? T
        : never
    : never;

/**
 * Extract the request body type for a specific API endpoint and method.
 *
 * @example
 *     type LoginBody = ApiRequestBody<"/api/v1/auth/login", "post">;
 */
export type ApiRequestBody<
    Path extends keyof paths,
    Method extends keyof paths[Path],
> = paths[Path][Method] extends {
    requestBody: { content: { "application/json": infer T } };
}
    ? T
    : never;

/**
 * Direct access to schema components (models). Use this for shared types that
 * aren't tied to specific endpoints.
 *
 * @example
 *     type Code = ApiSchema<"ErrorCode">;
 */
export type ApiSchema<T extends keyof components["schemas"]> =
    components["schemas"][T];
