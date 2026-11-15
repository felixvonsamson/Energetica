import { useState, useCallback } from "react";

export function useLocalStorage<T>(
    key: string,
    defaultValue: T,
    validate?: (value: unknown) => value is T,
): [T, (value: T) => void] {
    const [state, setState] = useState<T>(() => {
        try {
            const stored = localStorage.getItem(key);
            if (stored !== null) {
                const parsed: unknown = JSON.parse(stored);
                const isValid = validate
                    ? validate(parsed)
                    : typeof parsed === typeof defaultValue;
                if (isValid) {
                    return parsed as T;
                }
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
