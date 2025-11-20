/**
 * Error boundary for handling query errors gracefully
 * Shows stale data with error indicator instead of blank screen
 */

import { type ReactNode } from "react";

interface QueryErrorFallbackProps {
    error: Error;
    /** Stale data to display */
    data?: unknown;
    /** Custom retry function */
    retry?: () => void;
}

export function QueryErrorFallback({
    error,
    data,
    retry,
}: QueryErrorFallbackProps) {
    const hasStaleData = data !== undefined && data !== null;

    return (
        <div className="relative">
            {/* Show stale data if available */}
            {hasStaleData && (
                <div className="opacity-75 pointer-events-none">
                    {/* Data will be rendered by parent component */}
                </div>
            )}

            {/* Error overlay */}
            <div
                className={`${hasStaleData ? "absolute inset-0 flex items-center justify-center" : ""}`}
            >
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
                    <div className="flex items-start gap-3">
                        <i className="fa fa-exclamation-triangle text-red-600 text-xl mt-1"></i>
                        <div className="flex-1">
                            <h3 className="font-semibold text-red-900 mb-1">
                                Unable to load data
                            </h3>
                            <p className="text-sm text-red-700 mb-3">
                                {error.message ||
                                    "Please check your internet connection."}
                            </p>
                            {hasStaleData && (
                                <p className="text-xs text-red-600 mb-3">
                                    Showing cached data from your last
                                    connection.
                                </p>
                            )}
                            {retry && (
                                <button
                                    onClick={retry}
                                    className="text-sm bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                                >
                                    <i className="fa fa-refresh mr-2"></i>
                                    Try again
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Helper component to wrap query results with error handling
 */
interface QueryResultWrapperProps<T> {
    data: T | undefined;
    error: Error | null;
    isLoading: boolean;
    isError: boolean;
    refetch?: () => void;
    children: (data: T) => ReactNode;
    loadingFallback?: ReactNode;
}

export function QueryResultWrapper<T>({
    data,
    error,
    isLoading,
    isError,
    refetch,
    children,
    loadingFallback = <div>Loading...</div>,
}: QueryResultWrapperProps<T>) {
    // Initial loading (no data yet)
    if (isLoading && !data) {
        return <>{loadingFallback}</>;
    }

    // Error with no stale data
    if (isError && !data && error) {
        return <QueryErrorFallback error={error} retry={refetch} />;
    }

    // Error with stale data - show both
    if (isError && data && error) {
        return (
            <div className="relative">
                {/* Render stale data */}
                <div className="opacity-75">{children(data)}</div>
                {/* Subtle error indicator */}
                <div className="absolute top-2 right-2">
                    <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-3 py-1 rounded text-xs">
                        <i className="fa fa-exclamation-triangle mr-1"></i>
                        Data may be outdated
                    </div>
                </div>
            </div>
        );
    }

    // Success - render data
    if (data) {
        return <>{children(data)}</>;
    }

    // Shouldn't happen, but handle undefined
    return null;
}
