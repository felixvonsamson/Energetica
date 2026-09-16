/**
 * Central registry for the artwork shown on facility and technology cards. One
 * entry per project type, mapping it to the bundled image for that project.
 *
 * Follows the same pattern as asset-icons.ts, with one difference that is the
 * point of the file: the record is typed `Record<ProjectType, string>` rather
 * than `Record<string, string>`, so the compiler checks the join in both
 * directions. A project type the backend adds without artwork is a missing-key
 * error; an entry for a type the backend no longer has is an excess-property
 * error. The imports themselves are checked by Vite: a renamed, moved or
 * deleted file fails the build instead of 404ing in someone's browser.
 *
 * Each value is the hashed URL Vite emits for the image, so only the images
 * reached from a bundle are shipped with it.
 */

import coalMine from "@/assets/facilities/extraction/coal_mine.webp";
import gasDrillingSite from "@/assets/facilities/extraction/gas_drilling_site.webp";
import uraniumMine from "@/assets/facilities/extraction/uranium_mine.webp";
import carbonCapture from "@/assets/facilities/functional/carbon_capture.webp";
import industry from "@/assets/facilities/functional/industry.webp";
import laboratory from "@/assets/facilities/functional/laboratory.webp";
import warehouse from "@/assets/facilities/functional/warehouse.webp";
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
import steamEngine from "@/assets/facilities/power/steam_engine.webp";
import watermill from "@/assets/facilities/power/watermill.webp";
import windmill from "@/assets/facilities/power/windmill.webp";
import hydrogenStorage from "@/assets/facilities/storage/hydrogen_storage.webp";
import largePumpedHydro from "@/assets/facilities/storage/large_pumped_hydro.webp";
import lithiumIonBatteries from "@/assets/facilities/storage/lithium_ion_batteries.webp";
import moltenSalt from "@/assets/facilities/storage/molten_salt.webp";
import smallPumpedHydro from "@/assets/facilities/storage/small_pumped_hydro.webp";
import solidStateBatteries from "@/assets/facilities/storage/solid_state_batteries.webp";
import aerodynamics from "@/assets/technologies/aerodynamics.webp";
import buildingTechnology from "@/assets/technologies/building_technology.webp";
import chemistry from "@/assets/technologies/chemistry.webp";
import civilEngineering from "@/assets/technologies/civil_engineering.webp";
import materials from "@/assets/technologies/materials.webp";
import mathematics from "@/assets/technologies/mathematics.webp";
import mechanicalEngineering from "@/assets/technologies/mechanical_engineering.webp";
import mineralExtraction from "@/assets/technologies/mineral_extraction.webp";
import nuclearEngineering from "@/assets/technologies/nuclear_engineering.webp";
import physics from "@/assets/technologies/physics.webp";
import thermodynamics from "@/assets/technologies/thermodynamics.webp";
import transportTechnology from "@/assets/technologies/transport_technology.webp";
import { ProjectType } from "@/types/projects";

/**
 * The image for every project type the API can name. Indexing this with a
 * `ProjectType` always yields a URL — there is no missing-artwork case to
 * handle at runtime, because the compiler rules it out.
 */
export const assetImages: Record<ProjectType, string> = {
    // Power facilities — early game
    steam_engine: steamEngine,
    windmill: windmill,
    watermill: watermill,

    // Power facilities — fossil fuels
    coal_burner: coalBurner,
    gas_burner: gasBurner,
    combined_cycle: combinedCycle,

    // Power facilities — renewables
    small_water_dam: smallWaterDam,
    onshore_wind_turbine: onshoreWindTurbine,
    CSP_solar: cspSolar,
    PV_solar: pvSolar,

    // Power facilities — late game
    large_water_dam: largeWaterDam,
    offshore_wind_turbine: offshoreWindTurbine,
    nuclear_reactor: nuclearReactor,
    nuclear_reactor_gen4: nuclearReactorGen4,

    // Storage facilities
    small_pumped_hydro: smallPumpedHydro,
    molten_salt: moltenSalt,
    large_pumped_hydro: largePumpedHydro,
    hydrogen_storage: hydrogenStorage,
    lithium_ion_batteries: lithiumIonBatteries,
    solid_state_batteries: solidStateBatteries,

    // Extraction facilities
    coal_mine: coalMine,
    gas_drilling_site: gasDrillingSite,
    uranium_mine: uraniumMine,

    // Functional facilities
    laboratory: laboratory,
    warehouse: warehouse,
    industry: industry,
    carbon_capture: carbonCapture,

    // Technologies
    mathematics: mathematics,
    mechanical_engineering: mechanicalEngineering,
    thermodynamics: thermodynamics,
    physics: physics,
    building_technology: buildingTechnology,
    mineral_extraction: mineralExtraction,
    transport_technology: transportTechnology,
    materials: materials,
    civil_engineering: civilEngineering,
    aerodynamics: aerodynamics,
    chemistry: chemistry,
    nuclear_engineering: nuclearEngineering,
};
