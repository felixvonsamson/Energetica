/** Hook for managing a Set of toggled items (e.g., hidden chart series) */

import { useState, useCallback, useRef } from "react";

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

    // Keep a ref in sync so toggle can read current items without being
    // listed as a dependency (avoids the toggle function changing on every render).
    const itemsRef = useRef(items);
    itemsRef.current = items;

    const toggle = useCallback(
        (item: T) => {
            const next = new Set(itemsRef.current);
            if (next.has(item)) {
                next.delete(item);
            } else {
                next.add(item);
            }
            setItems(next);
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
        },
        [storageKey],
    );

    return [items, toggle] as const;
}
