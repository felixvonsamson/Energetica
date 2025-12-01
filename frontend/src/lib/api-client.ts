/**
 * Typed API client for making requests to the backend. Handles authentication,
 * error handling, and type safety.
 */

const API_BASE_URL = import.meta.env.DEV ? "/api/v1" : "/api/v1";

// Error response types from backend
export interface HttpErrorResponse {
    detail: string;
}

export interface GameErrorResponse {
    game_exception_type: string;
    kwargs?: Record<string, unknown>;
}

export interface ValidationErrorResponse {
    detail: Array<{ loc: string[]; msg: string; type: string }>;
    meta: { error_type: string };
}

export type ApiErrorResponse =
    | HttpErrorResponse
    | GameErrorResponse
    | ValidationErrorResponse;

// Type guards for narrowing error types
export function isHttpError(detail: unknown): detail is HttpErrorResponse {
    return (
        typeof detail === "object" &&
        detail !== null &&
        "detail" in detail &&
        typeof (detail as HttpErrorResponse).detail === "string"
    );
}

export function isGameError(detail: unknown): detail is GameErrorResponse {
    return (
        typeof detail === "object" &&
        detail !== null &&
        "game_exception_type" in detail &&
        typeof (detail as GameErrorResponse).game_exception_type === "string"
    );
}

export function isValidationError(
    detail: unknown,
): detail is ValidationErrorResponse {
    return (
        typeof detail === "object" &&
        detail !== null &&
        "detail" in detail &&
        Array.isArray((detail as ValidationErrorResponse).detail)
    );
}

export class ApiClientError extends Error {
    constructor(
        message: string,
        public status: number,
        public detail?: ApiErrorResponse,
    ) {
        super(message);
        this.name = "ApiClientError";
        this.detail = detail;
    }

    /**
     * Get a user-friendly error message from the error response. Handles
     * different backend error formats.
     */
    getErrorMessage(): string {
        if (isHttpError(this.detail)) {
            return this.detail.detail;
        }
        if (isGameError(this.detail)) {
            return this.detail.game_exception_type;
        }
        if (isValidationError(this.detail)) {
            return this.detail.detail.map((e) => e.msg).join(", ");
        }
        return this.message;
    }
}

interface RequestOptions extends RequestInit {
    params?: Record<string, string | number | boolean>;
}

/** Base fetch wrapper with error handling and type safety. */
async function fetchApi<T>(
    endpoint: string,
    options: RequestOptions = {},
): Promise<T> {
    const { params, ...fetchOptions } = options;

    // Build URL with query parameters
    let url = `${API_BASE_URL}${endpoint}`;
    if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            searchParams.append(key, String(value));
        });
        url += `?${searchParams.toString()}`;
    }

    // Default headers
    const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
    };

    // Make request
    const response = await fetch(url, {
        ...fetchOptions,
        headers,
        credentials: "include", // Important for cookie-based auth
    });

    // Handle errors
    if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        let errorDetails: ApiErrorResponse | undefined;

        try {
            const errorData = await response.json();
            errorDetails = errorData as ApiErrorResponse;

            // Extract message from the error response
            if (isHttpError(errorData)) {
                errorMessage = errorData.detail;
            } else if (isGameError(errorData)) {
                errorMessage = errorData.game_exception_type;
            } else if (isValidationError(errorData)) {
                errorMessage = errorData.detail.map((e) => e.msg).join(", ");
            }
        } catch {
            // If response is not JSON, use status text
            errorMessage = response.statusText || errorMessage;
        }

        throw new ApiClientError(errorMessage, response.status, errorDetails);
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return undefined as T;
    }

    // Parse JSON response
    return response.json();
}

/** API client with typed methods. */
export const apiClient = {
    /** GET request */
    get: <T>(endpoint: string, options?: RequestOptions) =>
        fetchApi<T>(endpoint, { ...options, method: "GET" }),

    /** POST request */
    post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
        fetchApi<T>(endpoint, {
            ...options,
            method: "POST",
            body: data ? JSON.stringify(data) : undefined,
        }),

    /** PUT request */
    put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
        fetchApi<T>(endpoint, {
            ...options,
            method: "PUT",
            body: data ? JSON.stringify(data) : undefined,
        }),

    /** PATCH request */
    patch: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
        fetchApi<T>(endpoint, {
            ...options,
            method: "PATCH",
            body: data ? JSON.stringify(data) : undefined,
        }),

    /** DELETE request */
    delete: <T>(endpoint: string, options?: RequestOptions) =>
        fetchApi<T>(endpoint, { ...options, method: "DELETE" }),
};
