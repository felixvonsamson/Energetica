/**
 * Typed API client for making requests to the backend. Handles authentication,
 * error handling, and type safety.
 */

const API_BASE_URL = import.meta.env.DEV ? "/api/v1" : "/api/v1";

interface ApiError {
    detail: string;
}

export class ApiClientError extends Error {
    constructor(
        message: string,
        public status: number,
        public details?: unknown,
    ) {
        super(message);
        this.name = "ApiClientError";
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
        let errorDetails: unknown;

        try {
            const errorData: ApiError = await response.json();
            errorMessage = errorData.detail || errorMessage;
            errorDetails = errorData;
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
