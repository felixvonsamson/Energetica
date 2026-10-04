/**
 * The Workshop phase countdown (#996): which decision the running phase is for,
 * and how to show the time left on it.
 *
 * The server sends the time left when it answered, not a clock time, so a
 * player's computer clock being off does not move the countdown. The page adds
 * that to the moment the answer arrived.
 */

import type { Checkpoint } from "@/lib/workshop-timeline";
import type { ApiSchema } from "@/types/api-helpers";

type PhaseTimer = ApiSchema<"WorkshopPhaseTimerOut">;

/**
 * The label beside the countdown, e.g. "Set prices", or `null` at a checkpoint
 * that has no countdown. A Trading period's countdown is its price-setting
 * window.
 */
export function phaseLabel(checkpoint: Checkpoint): string | null {
    switch (checkpoint.kind) {
        case "investment":
            return "Invest";
        case "trading_period":
            return "Set prices";
        case "not_started":
        case "recap":
        case "finished":
            return null;
        default:
            throw checkpoint satisfies never;
    }
}

/** When the phase closes, in epoch milliseconds, given when the answer arrived. */
export function phaseDeadline(timer: PhaseTimer, receivedAt: number): number {
    return receivedAt + timer.remaining_seconds * 1000;
}

/**
 * Time left as `m:ss`. A part-second rounds up, so `0:00` shows only once the
 * time is up.
 */
export function formatCountdown(remainingMs: number): string {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
