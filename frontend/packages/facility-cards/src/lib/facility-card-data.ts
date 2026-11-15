/**
 * The shapes the facility cards draw. The package declares them itself and
 * imports no API types, so any app can render a card: the Workshop passes its
 * API data, which has these fields and more, and the landing page passes demo
 * data.
 *
 * The unions below copy the Workshop backend's. The Workshop passes its API
 * data to the card, so a facility or a fuel the backend adds fails the
 * Workshop's typecheck until it is added here too.
 */

export type FacilityId =
    | "onshore_wind_turbine"
    | "offshore_wind_turbine"
    | "coal_burner"
    | "modern_coal_plant"
    | "gas_burner"
    | "combined_cycle"
    | "small_water_dam"
    | "large_water_dam"
    | "nuclear_reactor"
    | "nuclear_reactor_gen4"
    | "pv_solar"
    | "multi_layer_pv"
    | "csp_solar"
    | "lithium_ion_batteries"
    | "solid_state_batteries"
    | "hydrogen_storage"
    | "pumped_hydro";

export type Fuel = "coal" | "gas" | "uranium";

export type Season = "spring" | "summer" | "autumn" | "winter";

/**
 * A facility as its card and price tag draw it. Powers are in W, energies in
 * Wh, masses in kg and money in coins.
 */
export interface FacilityCardData {
    id: FacilityId;
    name: string;
    base_power_generation: number;
    /** Set for storage only, with `base_efficiency`. */
    base_storage_capacity: number | null;
    /** Set for storage only, with `base_storage_capacity`. */
    base_efficiency: number | null;
    /** CO₂ emitted per MWh generated. */
    base_pollution: number;
    /**
     * Its average output over a year of weather, as a share of its power, or
     * null for a facility that does not follow the weather.
     */
    capacity_factor: number | null;
    /**
     * What it generates in each season on average over many Runs' weather, or
     * null for a facility that does not follow the weather.
     */
    expected_generation: Partial<Record<Season, number>> | null;
    om_per_round: number;
    om_fixed_share: number;
    om_fixed_per_season: number;
    om_variable_per_mwh: number;
    fuel_type: Fuel | null;
    /** Fuel burned per MWh generated. */
    fuel_use: number | null;
    /** What it generates in a season at full output. */
    full_output_per_season: number;
    lifetime_rounds: number;
    /** How many Rounds after the one it is bought in it starts working. */
    construction_lag_rounds: number;
    /** What it costs to buy this Round, moved by any price shock (#1012). */
    price: number;
    /** What it costs to buy before any price shock. */
    base_price: number;
}

/**
 * What the card's tooltips need beyond the facility itself: the season's fuel
 * prices, the carbon tax and the session's Rounds.
 */
export interface TooltipInputs {
    /**
     * Each fuel's price per kg this season, or its catalog price before the
     * first season. A fuel left out gets no fuel-cost figure.
     */
    fuelPrices: Partial<Record<Fuel, number>>;
    /** What a carbon tax charges per kg of CO₂, or null if not known. */
    taxRate: number | null;
    /**
     * Whether a carbon tax vote has passed, so the tax is charged. Until then
     * the emissions have no tooltip.
     */
    taxInForce: boolean;
    /**
     * The Round a facility bought next is bought in, or null if none is. The
     * lifetime row's tooltip needs it.
     */
    buyRound: number | null;
    /** How many Rounds the session has, or null if not known. */
    roundCount: number | null;
}
