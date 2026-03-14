/** Utilities for calculating progress percentages for projects and shipments. */

import { useEffect, useState } from "react";

import { useGameEngine } from "@/hooks/use-game";
import { useGameTick } from "@/hooks/use-game-tick";
import { ProjectStatus } from "@/types/projects";

export function useProjectProgress(
    duration: number,
    endTick: number | null,
    ticksPassed: number | null,
    status: ProjectStatus,
) {
    const { currentTick, lastTickTimestamp } = useGameTick();
    const { data: engine } = useGameEngine();
    const [now, setNow] = useState(() => Date.now());

    // Update sub-tick clock every 500ms only while a project is ongoing
    useEffect(() => {
        if (status !== "ongoing") return;
        const id = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(id);
    }, [status]);

    if (currentTick === undefined) return 0;

    // For ongoing projects, interpolate fractional tick progress between server ticks
    let effectiveTick = currentTick;
    if (status === "ongoing" && lastTickTimestamp !== undefined) {
        const tickDurationMs = engine
            ? engine.wall_clock_seconds_per_tick * 1000
            : 60_000;
        const fraction = Math.min(1, (now - lastTickTimestamp) / tickDurationMs);
        effectiveTick = currentTick + fraction;
    }

    return calculateProjectProgress(
        duration,
        endTick,
        ticksPassed,
        effectiveTick,
        status,
    );
}

/**
 * Calculate progress percentage for a project (construction or research).
 *
 * Handles both ongoing and paused projects:
 *
 * - Ongoing: Progress based on end_tick and current_tick (supports fractional ticks for smooth animation)
 * - Paused: Progress based on ticks_passed
 *
 * @param duration - Total duration of the project in ticks
 * @param endTick - When the project will complete (for ongoing projects)
 * @param ticksPassed - How many ticks have passed (for paused projects)
 * @param currentTick - Current game tick (may be fractional for smooth interpolation)
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
        // Paused/waiting project: use ticks_passed
        return Math.min(100, Math.max(0, (ticksPassed / duration) * 100));
    } else if (status === "ongoing" && endTick !== null) {
        // Ongoing project: calculate from end_tick (currentTick may be fractional)
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
