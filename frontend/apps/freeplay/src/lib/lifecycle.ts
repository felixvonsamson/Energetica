/**
 * The in-game side of a run's lifecycle (#866, T8): when the "game freezes in…"
 * countdown shows, how the time left reads, and how to recognise the backend's
 * frozen-write rejection.
 *
 * The phase itself comes from `derivePhase` (`@energetica/core/instances`), the
 * frontend mirror of the backend's phase ladder. Everything here is pure so it
 * can be tested without a clock.
 */

import { ApiClientError } from "@energetica/core/api-client";
import type { Phase } from "@energetica/core/instances";

/**
 * The backend's `detail` on the `409` it returns for a game action sent to a
 * frozen instance (`reject_when_frozen`, #861).
 */
export const INSTANCE_FROZEN_DETAIL =
    "Instance is frozen; the game is read-only.";

/** How long before `freeze_at` the countdown banner first appears. */
export const FREEZE_COUNTDOWN_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Whether game actions are closed. True from `freeze` on: the backend rejects
 * them then, and an `ended` run's process is on its way down.
 */
export function isReadOnlyPhase(phase: Phase | undefined): boolean {
    return phase === "freeze" || phase === "ended";
}

/**
 * Whether the countdown to `freeze_at` shows: only during `active`, and only in
 * the final {@link FREEZE_COUNTDOWN_WINDOW_MS}. A run with no `freeze_at` never
 * freezes, so it never counts down.
 */
export function showFreezeCountdown(
    phase: Phase | undefined,
    freezeAt: string | null | undefined,
    now: number,
): boolean {
    if (phase !== "active" || !freezeAt) return false;
    const left = Date.parse(freezeAt) - now;
    return left > 0 && left <= FREEZE_COUNTDOWN_WINDOW_MS;
}

/**
 * A wall-clock duration, as coarse as is useful: "2d 4h", "3h 12m", or "4:32"
 * in the final hour, where the seconds start to matter.
 */
export function formatTimeLeft(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Whether an error is the backend refusing a game action because the instance
 * is frozen. The client normally stops sending these itself; this catches the
 * cases it can't see coming, such as an admin moving `freeze_at` earlier.
 */
export function isInstanceFrozenError(error: unknown): boolean {
    return (
        error instanceof ApiClientError &&
        error.status === 409 &&
        error.getErrorMessage() === INSTANCE_FROZEN_DETAIL
    );
}

/**
 * When game actions close, in epoch ms, or `null` for a run that never closes.
 * That is `freeze_at`, or `ended_at` for a run with no freeze phase: the phase
 * ladder goes straight from `active` to `ended` then, and the backend rejects
 * game actions from that moment too.
 */
export function readOnlyFrom(
    freezeAt: string | null | undefined,
    endedAt: string | null | undefined,
): number | null {
    const boundary = freezeAt ?? endedAt;
    if (!boundary) return null;
    const ms = Date.parse(boundary);
    return Number.isNaN(ms) ? null : ms;
}
