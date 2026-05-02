import { useState, useCallback } from "react";

export function useLocalStorage<T>(
    key: string,
    defaultValue: T,
): [T, (value: T) => void] {
    const [state, setState] = useState<T>(() => {
        try {
            const stored = localStorage.getItem(key);
            if (stored !== null) {
                return JSON.parse(stored) as T;
            }
        } catch {
            // ignore
        }
        return defaultValue;
    });

    const setValue = useCallback(
        (value: T) => {
            setState(value);
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch {
                // ignore
            }
        },
        [key],
    );

    return [state, setValue];
}
