/**
 * Client-side derivation of this instance's lifecycle phase.
 *
 * The backend self-drives its transitions from its own clock (#861 freeze, #862
 * announced) and exposes the three boundary timestamps on `/game/engine`; this
 * hook is the frontend mirror, deriving the phase the same way (`derivePhase`,
 * `lib/instances.ts`) so the UI can present "not started yet" / "read-only"
 * without waiting to learn about a transition from a rejected request.
 * Re-evaluated on a light wall-clock interval so a boundary crossed mid-session
 * flips the UI on its own.
 *
 * `starts_at`/`freeze_at`/`ended_at` come from the engine config, NOT from
 * `start_date` — `start_date` is the sim epoch, which during an announced
 * window is still process-start time (see `state_update`).
 */

import { useEffect, useState } from "react";

import { useGameEngine } from "@/hooks/use-game";
import { derivePhase, type Phase } from "@/lib/instances";

/**
 * The instance's current lifecycle phase, or `undefined` while the engine
 * config is still loading (or unavailable — an unconfigured/open-ended run,
 * where the caller should fail open to the live game, mirroring the backend's
 * fail-open-to-active phase read).
 *
 * @param intervalMs How often to re-derive against the wall clock. Default 1s —
 *   fine-grained enough for an announced countdown; callers that only need the
 *   coarse phase can pass a longer interval.
 */
export function usePhase(intervalMs = 1000): Phase | undefined {
    const { data: engine } = useGameEngine();
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);

    if (!engine?.starts_at) return undefined;
    return derivePhase(
        {
            starts_at: engine.starts_at,
            freeze_at: engine.freeze_at,
            ended_at: engine.ended_at,
        },
        now,
    );
}
