/**
 * One hex tile as the map draws it: its axial position, its resource levels and
 * its owner.
 *
 * The field names match the freeplay API's `HexTileOut`, so freeplay passes its
 * tiles in unchanged, and its type check fails if the two shapes drift apart.
 * Other callers, such as the lobby recap, adapt their own tiles to this shape.
 * The map never sends a tile back to an API, so it does not depend on any app's
 * generated types.
 */
export type MapTile = {
    /** Unique within one map. Used as the React key and for hover lookups. */
    id: number;
    q: number;
    r: number;
    solar: number;
    wind: number;
    hydro: number;
    coal: number;
    gas: number;
    uranium: number;
    climate_risk: number;
    /** The owner's id, or null for a vacant tile. */
    player_id: number | null;
};
