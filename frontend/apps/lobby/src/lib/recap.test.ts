import { describe, expect, it } from "vitest";

import { recapMapTiles, type RecapTile } from "@/lib/recap";

const tile = (owner: number | null, q: number): RecapTile => ({
    q,
    r: 0,
    solar: 0.5,
    wind: 0.25,
    hydro: 0,
    coal: 1000,
    gas: 0,
    uranium: 0,
    climate_risk: 3,
    owner_account_id: owner,
});

describe("recapMapTiles", () => {
    it("keeps every resource level and position", () => {
        const [mapTile] = recapMapTiles([tile(null, 4)]);

        expect(mapTile).toMatchObject({
            q: 4,
            r: 0,
            solar: 0.5,
            wind: 0.25,
            coal: 1000,
            climate_risk: 3,
        });
    });

    it("reports the owning account as the tile's owner", () => {
        const tiles = recapMapTiles([tile(7, 0), tile(null, 1)]);

        expect(tiles.map((t) => t.player_id)).toEqual([7, null]);
    });

    it("gives each tile a distinct id", () => {
        const tiles = recapMapTiles([tile(1, 0), tile(1, 1), tile(2, 2)]);

        expect(new Set(tiles.map((t) => t.id)).size).toBe(3);
    });
});
