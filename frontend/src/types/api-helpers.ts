/**
 * Helper types and utilities for working with generated API types.
 * This file provides convenient type extractors for the OpenAPI-generated types.
 */

import type { paths, components } from "./api.generated";

/**
 * Extract the response type for a specific API endpoint and method.
 *
 * @example
 * type UserData = ApiResponse<"/auth/me", "get">;
 * // Returns the 200 response type for GET /auth/me
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
 * type LoginBody = ApiRequestBody<"/auth/login", "post">;
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
 * Extract path parameters for a specific endpoint.
 *
 * @example
 * type FacilityParams = ApiPathParams<"/api/v1/facilities/{facilityId}">;
 */
export type ApiPathParams<Path extends keyof paths> = paths[Path] extends {
    parameters: { path: infer P };
}
    ? P
    : never;

/**
 * Extract query parameters for a specific endpoint and method.
 *
 * @example
 * type SearchParams = ApiQueryParams<"/api/v1/search", "get">;
 */
export type ApiQueryParams<
    Path extends keyof paths,
    Method extends keyof paths[Path],
> = paths[Path][Method] extends { parameters: { query: infer Q } }
    ? Q
    : never;

/**
 * Direct access to schema components (models).
 * Use this for shared types that aren't tied to specific endpoints.
 *
 * @example
 * type User = ApiSchema<"User">;
 */
export type ApiSchema<T extends keyof components["schemas"]> =
    components["schemas"][T];

/**
 * Type-safe API client method builder.
 * Ensures the path, method, and parameters match the OpenAPI spec.
 */
export type TypedEndpoint<
    Path extends keyof paths,
    Method extends keyof paths[Path],
> = {
    path: Path;
    method: Method;
    response: ApiResponse<Path, Method>;
    body: ApiRequestBody<Path, Method>;
    params: ApiPathParams<Path>;
    query: ApiQueryParams<Path, Method>;
};
