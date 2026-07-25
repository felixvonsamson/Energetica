/**
 * THROWAWAY PROTOTYPE — recap page look, issue #864 (T6).
 *
 * T9-schema (ADR-0005) mock recap: no `rank`, two un-netted CO2 columns
 * (`produced_co2` + `captured_co2`), a per-tile map snapshot. Data is
 * SYNTHESIZED (deterministic seed) — the shapes mirror
 * `energetica/schemas/recap.py` so the variants render against something real.
 *
 * Delete this whole `recap-prototype/` dir once a variant wins — see
 * `.claude/skills/prototype/UI.md`.
 */

export type RecapRow = {
    account_id: number;
    username_at_freeze: string;
    network_name: string | null;
    operating_income: number;
    xp: number;
    produced_co2: number; // gross, kg
    captured_co2: number; // kg, shown un-netted against produced
};

export type RecapTile = {
    q: number;
    r: number;
    solar: number; // 0..1 potential
    wind: number; // 0..1 potential
    hydro: number; // 0..1 potential (>0 ≈ river)
    coal: number; // remaining reserve, kg
    gas: number; // remaining reserve, kg
    uranium: number; // remaining reserve, kg
    climate_risk: number; // 0..10
    owner_account_id: number | null;
};

export type Recap = {
    slug: string;
    name: string;
    starts_at: string;
    freeze_at: string | null;
    ended_at: string | null;
    player_count: number;
    total_produced_co2: number;
    total_captured_co2: number;
    total_net_emissions: number;
    rows: RecapRow[];
    tiles: RecapTile[];
};

// --- deterministic RNG so the mock is stable across reloads --------------
function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const NAMES = [
    ["solaris_prime", "Nordlicht Grid"],
    ["kelvin_watt", "Nordlicht Grid"],
    ["meridian", null],
    ["ampere_ash", "Tidewater Co-op"],
    ["gigawatt_gwen", "Tidewater Co-op"],
    ["fjord_flux", "Nordlicht Grid"],
    ["obsidian_ohm", null],
    ["prairie_photon", "Sunbelt Union"],
    ["deep_current", "Sunbelt Union"],
    ["ember_edda", null],
    ["turbine_tess", "Tidewater Co-op"],
    ["cobalt_cass", "Sunbelt Union"],
] as const;

function makeRows(rng: () => number): RecapRow[] {
    return NAMES.map(([username, network], i) => {
        const income = Math.round((0.3 + rng()) * 4_800_000);
        // heavy emitters and heavy capturers are deliberately different people
        const produced = Math.round((0.2 + rng()) * 900_000);
        const captured = Math.round((0.1 + rng()) * 260_000);
        const xp = Math.round((0.4 + rng()) * 150_000);
        return {
            account_id: 100 + i,
            username_at_freeze: username,
            network_name: network,
            operating_income: income,
            xp,
            produced_co2: produced,
            captured_co2: captured,
        };
    });
}

function makeTiles(rng: () => number, owners: number[]): RecapTile[] {
    const RADIUS = 6;
    const tiles: RecapTile[] = [];
    const coords: [number, number][] = [];
    for (let q = -RADIUS; q <= RADIUS; q++) {
        for (let r = -RADIUS; r <= RADIUS; r++) {
            if (Math.abs(q + r) > RADIUS) continue;
            coords.push([q, r]);
        }
    }
    // scatter owned tiles across the map
    const ownedIdx = new Set<number>();
    while (ownedIdx.size < owners.length) {
        ownedIdx.add(Math.floor(rng() * coords.length));
    }
    const ownedList = [...ownedIdx];

    coords.forEach(([q, r], i) => {
        const isRiver = rng() > 0.78;
        const ownerSlot = ownedList.indexOf(i);
        tiles.push({
            q,
            r,
            solar: +(0.2 + rng() * 0.8).toFixed(3),
            wind: +(rng() * 0.9).toFixed(3),
            hydro: isRiver ? +(0.3 + rng() * 0.7).toFixed(3) : 0,
            coal: rng() > 0.6 ? Math.round(rng() * 2_000_000_000) : 0,
            gas: rng() > 0.7 ? Math.round(rng() * 600_000_000) : 0,
            uranium: rng() > 0.85 ? Math.round(rng() * 8_000_000) : 0,
            climate_risk: +(rng() * 10).toFixed(1),
            owner_account_id: ownerSlot >= 0 ? owners[ownerSlot]! : null,
        });
    });
    return tiles;
}

export function makeMockRecap(): Recap {
    const rng = mulberry32(0x5eed);
    const rows = makeRows(rng);
    const owners = rows.map((row) => row.account_id);
    const tiles = makeTiles(rng, owners);
    // default emission order: most consequential (income) first
    rows.sort((a, b) => b.operating_income - a.operating_income);
    return {
        slug: "summer-2026",
        name: "Summer 2026",
        starts_at: "2026-06-01T09:00:00Z",
        freeze_at: "2026-07-15T18:00:00Z",
        ended_at: null,
        player_count: rows.length,
        total_produced_co2: rows.reduce((s, r) => s + r.produced_co2, 0),
        total_captured_co2: rows.reduce((s, r) => s + r.captured_co2, 0),
        total_net_emissions: rows.reduce(
            (s, r) => s + r.produced_co2 - r.captured_co2,
            0,
        ),
        rows,
        tiles,
    };
}

// --- shared retrospective helpers ---------------------------------------

export type Measure = {
    key: "operating_income" | "xp" | "produced_co2" | "captured_co2";
    label: string;
    /** Narrative gloss — "a way to have mattered", not "a way to win" */
    gloss: string;
    format: (n: number) => string;
};

const fmtMoney = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const fmtMass = (n: number) =>
    n >= 1000
        ? `${(n / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })} t`
        : `${Math.round(n)} kg`;
const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

export const MEASURES: Measure[] = [
    {
        key: "operating_income",
        label: "Operating income",
        gloss: "Most consequential",
        format: fmtMoney,
    },
    {
        key: "captured_co2",
        label: "CO₂ captured",
        gloss: "Deepest decarboniser",
        format: fmtMass,
    },
    {
        key: "produced_co2",
        label: "CO₂ produced",
        gloss: "Heaviest hand",
        format: fmtMass,
    },
    { key: "xp", label: "XP", gloss: "Furthest along", format: fmtInt },
];

/** Account_ids in the top 3 for a given measure (client-derived emphasis). */
export function topThree(
    rows: RecapRow[],
    key: Measure["key"],
): Map<number, number> {
    const ranked = [...rows]
        .sort((a, b) => b[key] - a[key])
        .slice(0, 3)
        .map((r) => r.account_id);
    return new Map(ranked.map((id, i) => [id, i + 1]));
}
