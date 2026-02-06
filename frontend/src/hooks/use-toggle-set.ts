/** Hook for managing a Set of toggled items (e.g., hidden chart series) */

import { useState, useCallback } from "react";

/**
 * Manages a Set-based toggle state, commonly used for tracking visibility of
 * chart series or table rows.
 *
 * @example
 *     ```tsx
 *     const [hiddenSeries, toggleSeries] = useToggleSet<string>();
 *     <button onClick={() => toggleSeries("coal")}>
 *       {hiddenSeries.has("coal") ? "Show" : "Hide"}
 *     </button>
 *     ```;
 *
 * @param initialState - Initial Set of items (defaults to empty Set)
 * @returns Tuple of [items, toggle] where toggle adds/removes items from the
 *   Set
 */
export function useToggleSet<T>(initialState?: Set<T>) {
    const [items, setItems] = useState<Set<T>>(initialState ?? new Set());

    const toggle = useCallback((item: T) => {
        setItems((prev) => {
            const next = new Set(prev);
            if (next.has(item)) {
                next.delete(item);
            } else {
                next.add(item);
            }
            return next;
        });
    }, []);

    return [items, toggle] as const;
}
