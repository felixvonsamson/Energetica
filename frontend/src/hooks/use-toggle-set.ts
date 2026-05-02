/** Hook for managing a Set of toggled items (e.g., hidden chart series) */

import { useState, useCallback } from "react";

export function useToggleSet<T>(
    initialState?: Set<T>,
    storageKey?: string,
) {
    const [items, setItems] = useState<Set<T>>(() => {
        if (storageKey) {
            try {
                const stored = localStorage.getItem(storageKey);
                if (stored !== null) {
                    return new Set(JSON.parse(stored) as T[]);
                }
            } catch {
                // ignore
            }
        }
        return initialState ?? new Set();
    });

    const toggle = useCallback(
        (item: T) => {
            setItems((prev) => {
                const next = new Set(prev);
                if (next.has(item)) {
                    next.delete(item);
                } else {
                    next.add(item);
                }
                if (storageKey) {
                    try {
                        localStorage.setItem(
                            storageKey,
                            JSON.stringify(Array.from(next)),
                        );
                    } catch {
                        // ignore
                    }
                }
                return next;
            });
        },
        [storageKey],
    );

    return [items, toggle] as const;
}
