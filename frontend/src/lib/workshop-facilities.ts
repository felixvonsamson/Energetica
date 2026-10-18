/**
 * The artwork and colour of each Workshop facility (#998).
 *
 * Workshop's facilities are its own (#975), so they are keyed by Workshop's
 * `FacilityId`, not the persistent world's `ProjectType`. Typed as a full
 * record, so a facility the backend adds without artwork fails the typecheck.
 * The two net-new facilities borrow the image of their base tier until they get
 * their own.
 */

import coalBurner from "@/assets/facilities/power/coal_burner.webp";
import combinedCycle from "@/assets/facilities/power/combined_cycle.webp";
import cspSolar from "@/assets/facilities/power/CSP_solar.webp";
import gasBurner from "@/assets/facilities/power/gas_burner.webp";
import largeWaterDam from "@/assets/facilities/power/large_water_dam.webp";
import nuclearReactor from "@/assets/facilities/power/nuclear_reactor.webp";
import nuclearReactorGen4 from "@/assets/facilities/power/nuclear_reactor_gen4.webp";
import offshoreWindTurbine from "@/assets/facilities/power/offshore_wind_turbine.webp";
import onshoreWindTurbine from "@/assets/facilities/power/onshore_wind_turbine.webp";
import pvSolar from "@/assets/facilities/power/PV_solar.webp";
import smallWaterDam from "@/assets/facilities/power/small_water_dam.webp";
import hydrogenStorage from "@/assets/facilities/storage/hydrogen_storage.webp";
import largePumpedHydro from "@/assets/facilities/storage/large_pumped_hydro.webp";
import lithiumIonBatteries from "@/assets/facilities/storage/lithium_ion_batteries.webp";
import solidStateBatteries from "@/assets/facilities/storage/solid_state_batteries.webp";
import { assetCSSColourVariable } from "@/lib/assets/asset-colors";
import type { ApiSchema } from "@/types/api-helpers";

type FacilityId = ApiSchema<"FacilityId">;
type WorkshopFacility = ApiSchema<"WorkshopFacilityOut">;

export const workshopFacilityImages: Record<FacilityId, string> = {
    onshore_wind_turbine: onshoreWindTurbine,
    offshore_wind_turbine: offshoreWindTurbine,
    coal_burner: coalBurner,
    modern_coal_plant: coalBurner,
    gas_burner: gasBurner,
    combined_cycle: combinedCycle,
    small_water_dam: smallWaterDam,
    large_water_dam: largeWaterDam,
    nuclear_reactor: nuclearReactor,
    nuclear_reactor_gen4: nuclearReactorGen4,
    pv_solar: pvSolar,
    multi_layer_pv: pvSolar,
    csp_solar: cspSolar,
    lithium_ion_batteries: lithiumIonBatteries,
    solid_state_batteries: solidStateBatteries,
    hydrogen_storage: hydrogenStorage,
    pumped_hydro: largePumpedHydro,
};

/**
 * The facility's colour, the same one the charts use. Each Workshop facility
 * has an `--asset-color-*` token in `global.css`.
 */
export function workshopFacilityColor(id: FacilityId): string {
    return assetCSSColourVariable(id);
}

/**
 * Whether the facility stores energy. Storage has a capacity and an efficiency
 * and generators have neither, so a storage facility has both set.
 */
export function isStorage(
    facility: WorkshopFacility,
): facility is WorkshopFacility & {
    base_storage_capacity: number;
    base_efficiency: number;
} {
    return (
        facility.base_storage_capacity !== null &&
        facility.base_efficiency !== null
    );
}

/**
 * A price in the catalog, always in millions (#1247): "8M", "7.5M". This is an
 * exception to the usual money formatting, which would show "8'000k", so that
 * every price on the catalog reads in the same unit.
 */
export function formatCatalogPrice(amount: number): string {
    const tenths = Math.round(amount / 100_000);
    const whole = Math.trunc(tenths / 10)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    const decimal = Math.abs(tenths % 10);
    return decimal === 0 ? `${whole}M` : `${whole}.${decimal}M`;
}

/**
 * The fuel a facility burns per MWh, always in kg/MWh (#1247), so that players
 * comparing fuels never have to convert units: "640 kg/MWh", "0.044 kg/MWh".
 */
export function formatFuelUse(kgPerMWh: number): string {
    return `${Number(kgPerMWh.toPrecision(3))} kg/MWh`;
}
