/**
 * Type definitions for the map. These types correspond to the backend schemas
 * in energetica/schemas/map.py
 */

// TODO: I feel like this should be retrievable from the generated API types.

interface HexTileOut {
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
    player_id: number | null;
}
