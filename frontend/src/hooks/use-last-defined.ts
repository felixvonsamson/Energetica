import { useState } from "react";

export function useLastDefined<T>(value: T | null): T | null {
    const [last, setLast] = useState(value);
    if (value !== null && value !== last) setLast(value);
    return last;
}
