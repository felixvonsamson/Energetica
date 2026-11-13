/**
 * Lobby-side consumer of a run's published recap — the frozen JSON tombstone
 * minted once at `active → freeze` (G1/T5) and served statically beside the
 * instance fragment (`/recaps/{slug}.json`, Apache-aliased in prod from the
 * shared landing dir; see `docs/architecture/static-serving-and-deployment.md`
 * § Recap publication).
 *
 * Mirrors the backend `Recap`/`RecapRow`/`RecapTile` models
 * (`energetica/identity/schemas/recap.py`). Hand-mirrored rather than
 * `generate-types`-derived: the recap is never served through a FastAPI route
 * (it's a static file, sized to be fetched with no live backend), so it never
 * reaches the OpenAPI schema `generate-types` reads.
 *
 * The recap is a retrospective, not a scoreboard (ADR-0005): there is no
 * `rank`, and CO2 is laid bare as two un-netted columns — gross `produced_co2`
 * and `captured_co2` — so a heavy emitter who also captures heavily reads as
 * exactly that, not as a single netted number.
 */

import type { Lifecycle } from "@energetica/core/instances";
import type { MapTile } from "@energetica/map/lib/map-tile";

/** One player's row of the per-player retrospective table (no rank — ADR-0005). */
export type RecapRow = {
    /** Server-wide account FK, retained for future identity resolution. */
    account_id: number;
    /** The player's name as it was at freeze (frozen photograph). */
    username_at_freeze: string;
    /** The player's network/team at freeze, or null if unaffiliated. */
    network_name: string | null;
    /** Lifetime cumulated operating income. Default (un-ranked) row order. */
    operating_income: number;
    /** Experience points — how far the player progressed. */
    xp: number;
    /** Gross CO2 produced, in kg — shown un-netted against captured. */
    produced_co2: number;
    /** Total CO2 captured, in kg — shown un-netted against produced. */
    captured_co2: number;
};

/**
 * One tile of the frozen map snapshot: a `MapTile` without `id`, with
 * `player_id` swapped for the durable `owner_account_id` (joins {@link RecapRow}
 * by `account_id`). {@link recapMapTiles} converts it back for the map.
 * Renewable fields are 0–1 potentials; fuel fields are the reserves remaining
 * at freeze, in kg.
 */
export type RecapTile = {
    q: number;
    r: number;
    solar: number;
    wind: number;
    hydro: number;
    coal: number;
    gas: number;
    uranium: number;
    climate_risk: number;
    owner_account_id: number | null;
};

/**
 * The full published recap payload: an identity/totals header, the per-player
 * table, and the map snapshot. Satisfies {@link Lifecycle} so it can share phase
 * helpers with instance fragments, though by the time a recap is fetchable its
 * phase is always `freeze` or `ended`.
 */
export type Recap = Lifecycle & {
    slug: string;
    name: string;
    player_count: number;
    /** Sum of gross CO2 produced across all players, in kg. */
    total_produced_co2: number;
    /** Sum of CO2 captured across all players, in kg. */
    total_captured_co2: number;
    /** Sum of net CO2 emissions across all players, in kg. */
    total_net_emissions: number;
    rows: RecapRow[];
    tiles: RecapTile[];
};

/**
 * Adapt the recap's tiles to the shape the shared map draws. The array index
 * becomes the tile's `id`: the map uses it only as a React key and for hover
 * lookups, and the recap's tile list never changes. The owning account becomes
 * `player_id`, which the map reads as "owned by", so labels and colours work as
 * on the live map.
 */
export function recapMapTiles(tiles: RecapTile[]): MapTile[] {
    return tiles.map(({ owner_account_id, ...tile }, index) => ({
        ...tile,
        id: index,
        player_id: owner_account_id,
    }));
}

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
