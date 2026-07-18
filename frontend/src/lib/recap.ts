/**
 * Lobby-side consumer of a run's published recap — the frozen JSON tombstone
 * minted once at `active → freeze` (G1/T5) and served statically beside the
 * instance fragment (`/recaps/{slug}.json`, Apache-aliased in prod from the
 * shared landing dir; see `docs/architecture/static-serving-and-deployment.md`
 * § Recap publication).
 *
 * Mirrors the backend `Recap`/`RecapRow` models
 * (`energetica/schemas/recap.py`). Hand-mirrored rather than
 * `generate-types`-derived: the recap is never served through a FastAPI route
 * (it's a static file, sized to be fetched with no live backend), so it never
 * reaches the OpenAPI schema `generate-types` reads.
 */

import type { Lifecycle } from "./instances";

/** One player's final standing — one row of the income-ranked leaderboard. */
export type RecapRow = {
    /** 1-based placement by `operating_income` desc — the medal. */
    rank: number;
    /** Server-wide account FK, retained for future identity resolution. */
    account_id: number;
    /** The player's name as it was at freeze (frozen photograph). */
    username_at_freeze: string;
    /** The player's network/team at freeze, or null if unaffiliated. */
    network_name: string | null;
    /** Lifetime cumulated operating income — the sort key, "who won". */
    operating_income: number;
    /** Experience points — "how far I got". */
    xp: number;
    /** Total captured CO2 in kg. */
    captured_co2: number;
};

/**
 * The full published recap payload: an identity/totals header plus the
 * income-ranked table. Satisfies {@link Lifecycle} so it can share phase helpers
 * with instance fragments and `MyRun`, though by the time a recap is fetchable
 * its phase is always `freeze` or `ended`.
 */
export type Recap = Lifecycle & {
    slug: string;
    name: string;
    player_count: number;
    /** Sum of `captured_co2` across all players, in kg. */
    total_captured_co2: number;
    /** Sum of net CO2 emissions across all players, in kg. */
    total_net_emissions: number;
    rows: RecapRow[];
};

/**
 * Thrown by {@link fetchRecap} when the run hasn't reached `freeze` yet, so no
 * recap has been minted.
 */
export class RecapNotMintedError extends Error {
    constructor(slug: string) {
        super(`No recap published yet for "${slug}" — the run hasn't frozen.`);
        this.name = "RecapNotMintedError";
    }
}

/**
 * Fetch a run's published recap.
 *
 * @throws {RecapNotMintedError} When the run is not yet in `freeze`/`ended` (no
 *   recap has been minted, i.e. a 404).
 */
export async function fetchRecap(
    slug: string,
    signal?: AbortSignal,
): Promise<Recap> {
    const response = await fetch(`/recaps/${slug}.json`, { signal });
    if (response.status === 404) throw new RecapNotMintedError(slug);
    if (!response.ok)
        throw new Error(
            `Failed to fetch recap for ${slug}: ${response.status}`,
        );
    return (await response.json()) as Recap;
}
