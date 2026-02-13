/** Utilities for calculating progress percentages for projects and shipments. */

import { useGameTick } from "@/hooks/use-game-tick";
import { ProjectStatus } from "@/types/projects";

export function useProjectProgress(
    duration: number,
    endTick: number | null,
    ticksPassed: number | null,
    status: ProjectStatus,
) {
    const { currentTick } = useGameTick();
    if (currentTick === undefined) return 0;
    return calculateProjectProgress(
        duration,
        endTick,
        ticksPassed,
        currentTick,
        status,
    );
}

/**
 * Calculate progress percentage for a project (construction or research).
 *
 * Handles both ongoing and paused projects:
 *
 * - Ongoing: Progress based on end_tick and current_tick
 * - Paused: Progress based on ticks_passed
 *
 * @param duration - Total duration of the project in ticks
 * @param endTick - When the project will complete (for ongoing projects)
 * @param ticksPassed - How many ticks have passed (for paused projects)
 * @param currentTick - Current game tick
 * @param status - Project status
 * @returns Progress as percentage (0-100)
 */
export function calculateProjectProgress(
    duration: number,
    endTick: number | null,
    ticksPassed: number | null,
    currentTick: number,
    status: ProjectStatus,
): number {
    if ((status === "paused" || status === "waiting") && ticksPassed !== null) {
        // Paused project: use ticks_passed
        return Math.min(100, Math.max(0, (ticksPassed / duration) * 100));
    } else if (status === "ongoing" && endTick !== null) {
        // Ongoing or waiting project: calculate from end_tick
        const ticksRemaining = Math.max(0, endTick - currentTick);
        const ticksCompleted = duration - ticksRemaining;
        return Math.min(100, Math.max(0, (ticksCompleted / duration) * 100));
    }

    // Fallback: no progress
    return 0;
}

export function useShipmentProgress(
    duration: number,
    arrivalTick: number,
): number {
    const { currentTick } = useGameTick();
    if (currentTick === undefined) return 0;
    return calculateShipmentProgress(duration, arrivalTick, currentTick);
}

/**
 * Calculate progress percentage for a shipment.
 *
 * @param duration - Total duration of the shipment in ticks
 * @param arrivalTick - When the shipment will arrive
 * @param currentTick - Current game tick
 * @returns Progress as percentage (0-100)
 */
export function calculateShipmentProgress(
    duration: number,
    arrivalTick: number,
    currentTick: number,
): number {
    const ticksRemaining = Math.max(0, arrivalTick - currentTick);
    const ticksCompleted = duration - ticksRemaining;
    return Math.min(100, Math.max(0, (ticksCompleted / duration) * 100));
}
