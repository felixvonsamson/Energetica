import { useEffect, useState } from "react";

/**
 * The current time, updated every `intervalMs`. The run list reads it so that a
 * "Starts in 25 min" badge counts down and a run moves from Coming up to Now
 * while the page sits open. Polling alone does not do this: React Query only
 * re-renders when the fetched data changes.
 */
export function useNow(intervalMs = 30_000): Date {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}
