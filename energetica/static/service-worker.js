// AUTO-GENERATED — do not edit. Run `bun run build:sw` in frontend/ to regenerate.
// src/lib/format-utils.ts
var POWER_UNITS = [" W", " kW", " MW", " GW", " TW"];
var ENERGY_UNITS = [" Wh", " kWh", " MWh", " GWh", " TWh"];
var MASS_UNITS = [" kg", " t", " kt", " Mt"];
function generalFormat(value, units, threshold = 1e4) {
  let unitIndex = 0;
  while (Math.abs(value) >= threshold && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }
  return `${value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}${units[unitIndex]}`;
}
function formatPower(power, threshold = 1e4) {
  return generalFormat(power, POWER_UNITS, threshold);
}
function formatEnergy(energy, threshold = 1e4) {
  return generalFormat(energy, ENERGY_UNITS, threshold);
}
function formatMass(mass, threshold = 1e4, label) {
  const formatted = generalFormat(mass, MASS_UNITS, threshold);
  return label ? `${formatted} ${label}` : formatted;
}
function formatMoney(amount, long = false) {
  if (long) {
    return amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }
  const units = ["", "k", "M", "Md"];
  let value = amount;
  let unitIndex = 0;
  while (Math.abs(value) >= 1e4 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }
  const formatted = value.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return unitIndex > 0 ? `${formatted}${units[unitIndex]}` : formatted;
}

// src/lib/achievement-config.ts
var POWER_CONSUMPTION_COMPARISON_LABELS = {
  "village-in-europe": "a village in Europe",
  "city-of-basel": "the city of Basel",
  switzerland: "Switzerland",
  japan: "Japan",
  "world-population": "the entire world population"
};
var ENERGY_STORAGE_COMPARISON_LABELS = {
  "zurich-for-a-day": "Zurich for a day",
  "switzerland-for-a-day": "Switzerland for a day",
  "switzerland-for-a-month": "Switzerland for a month"
};
var ACHIEVEMENT_MILESTONE_CONFIG = {
  power_consumption: {
    name: "Power Consumption",
    format: formatPower,
    body: (p) => `You have passed the milestone of ${formatPower(p.threshold)} of power consumption. You consume as much electricity as ${POWER_CONSUMPTION_COMPARISON_LABELS[p.comparison_key]}.`
  },
  energy_storage: {
    name: "Energy Storage",
    format: formatEnergy,
    body: (p) => `You have stored ${formatEnergy(p.threshold)} of energy, enough to power ${ENERGY_STORAGE_COMPARISON_LABELS[p.comparison_key]}.`
  },
  mineral_extraction: {
    name: "Mineral Extraction",
    format: formatMass,
    body: (p) => `You have extracted ${formatMass(p.threshold)} of resources.`
  },
  network_import: {
    name: "Network Import",
    format: formatEnergy,
    body: (p) => `You have imported more than ${formatEnergy(p.threshold)} on the market.`
  },
  network_export: {
    name: "Network Export",
    format: formatEnergy,
    body: (p) => `You have exported more than ${formatEnergy(p.threshold)} on the market.`
  },
  network: {
    name: "Unlock Network",
    format: formatPower,
    body: (_p) => "Your generation capacities are now big enough to join a network and trade electricity. See Community > Network."
  },
  technology: {
    name: "Technology",
    format: (v) => v.toString(),
    body: (p) => `You have researched a total of ${p.threshold} levels of technologies.`
  },
  trading_export: {
    name: "Resource Export",
    format: formatMass,
    body: (p) => `You have exported more than ${formatMass(p.threshold)} of resources.`
  },
  trading_import: {
    name: "Resource Import",
    format: formatMass,
    body: (p) => `You have imported more than ${formatMass(p.threshold)} of resources.`
  }
};
var ACHIEVEMENT_UNLOCK_CONFIG = {
  laboratory: {
    name: "Unlock Technologies",
    body: "You have built a laboratory, you can now research technologies to unlock new facilities or improve existing ones."
  },
  warehouse: {
    name: "Unlock Natural Resources",
    body: "You have built a warehouse to store natural resources, you can now buy resources on the resource market or extract them yourself by building extraction facilities."
  },
  storage_facilities: {
    name: "First Storage Facility",
    body: "You have built your first storage facility, you can monitor the stored energy in the energy storage overview."
  },
  GHG_effect: {
    name: "Discover the Greenhouse Effect",
    body: "Scientists have discovered the greenhouse effect and have shown that climate change is caused by human activities and increases the risk of extreme weather events. You can now monitor your CO2 emissions and the climate anomalies in the emissions overview."
  }
};

// src/lib/assets/asset-names.ts
var powerFacilityNames = {
  steam_engine: {
    long: "Steam Engine",
    short: "Steam Engine"
  },
  windmill: {
    long: "Windmill",
    short: "Windmill"
  },
  watermill: {
    long: "Watermill",
    short: "Watermill"
  },
  coal_burner: {
    long: "Coal Burner",
    short: "Coal Plant"
  },
  gas_burner: {
    long: "Gas Burner",
    short: "Gas Plant"
  },
  combined_cycle: {
    long: "Combined Cycle",
    short: "CCGT"
  },
  small_water_dam: {
    long: "Small Water Dam",
    short: "Small Dam"
  },
  onshore_wind_turbine: {
    long: "Onshore Wind Turbine",
    short: "Onshore Wind"
  },
  CSP_solar: {
    long: "Concentrated Solar Power",
    short: "CSP"
  },
  PV_solar: {
    long: "Photovoltaics",
    short: "PV Solar"
  },
  large_water_dam: {
    long: "Large Water Dam",
    short: "Large Dam"
  },
  offshore_wind_turbine: {
    long: "Offshore Wind Turbine",
    short: "Offshore Wind"
  },
  nuclear_reactor: {
    long: "Nuclear Reactor",
    short: "Nuclear"
  },
  nuclear_reactor_gen4: {
    long: "4th Generation Nuclear",
    short: "Gen4 Nuclear"
  }
};
var storageFacilityNames = {
  small_pumped_hydro: {
    long: "Small Pumped Hydro Storage",
    short: "Hydro Storage (S)"
  },
  molten_salt: {
    long: "Molten Salt",
    short: "Molten Salt"
  },
  large_pumped_hydro: {
    long: "Large Pumped Hydro Storage",
    short: "Hydro Storage (L)"
  },
  hydrogen_storage: {
    long: "Hydrogen Hydrolysis",
    short: "Hydrogen"
  },
  lithium_ion_batteries: {
    long: "Lithium-Ion Batteries",
    short: "Li-ion"
  },
  solid_state_batteries: {
    long: "Solid State Batteries",
    short: "Solid State"
  }
};
var extractionFacilityNames = {
  coal_mine: {
    long: "Coal Mine",
    short: "Coal Mine"
  },
  gas_drilling_site: {
    long: "Gas Drilling Site",
    short: "Gas Site"
  },
  uranium_mine: {
    long: "Uranium Mine",
    short: "U Mine"
  }
};
var functionalFacilityNames = {
  laboratory: {
    long: "Laboratory",
    short: "Laboratory"
  },
  warehouse: {
    long: "Warehouse",
    short: "Warehouse"
  },
  industry: {
    long: "Industry",
    short: "Industry"
  },
  carbon_capture: {
    long: "Carbon Capture",
    short: "CC"
  }
};
var technologyNames = {
  mathematics: {
    long: "Mathematics",
    short: "Math"
  },
  mechanical_engineering: {
    long: "Mechanical Engineering",
    short: "Mech Eng"
  },
  thermodynamics: {
    long: "Thermodynamics",
    short: "Thermo"
  },
  physics: {
    long: "Physics",
    short: "Physics"
  },
  building_technology: {
    long: "Building Technology",
    short: "Building"
  },
  mineral_extraction: {
    long: "Mineral Extraction",
    short: "Mining"
  },
  transport_technology: {
    long: "Transport Technology",
    short: "Transport"
  },
  materials: {
    long: "Materials",
    short: "Materials"
  },
  civil_engineering: {
    long: "Civil Engineering",
    short: "Civil Eng"
  },
  aerodynamics: {
    long: "Aerodynamics",
    short: "Aero"
  },
  chemistry: {
    long: "Chemistry",
    short: "Chemistry"
  },
  nuclear_engineering: {
    long: "Nuclear Engineering",
    short: "Nuclear Eng"
  }
};
var resourceNames = {
  coal: {
    long: "Coal",
    short: "Coal"
  },
  gas: {
    long: "Gas",
    short: "Gas"
  },
  uranium: {
    long: "Uranium",
    short: "U"
  }
};
var specialNames = {
  transport: {
    long: "Shipments",
    short: "Shipments"
  },
  construction: {
    long: "Construction",
    short: "Construction"
  },
  research: {
    long: "Research",
    short: "Research"
  },
  reference: {
    long: "Reference",
    short: "Ref"
  },
  CO2: {
    long: "CO₂ Emissions",
    short: "CO₂"
  },
  exports: {
    long: "Exports",
    short: "Exports"
  },
  imports: {
    long: "Imports",
    short: "Imports"
  },
  dumping: {
    long: "Dumping",
    short: "Dumping"
  },
  "net-profit": {
    long: "Net Profit",
    short: "Net Profit"
  },
  price: {
    long: "Price",
    short: "Price"
  },
  quantity: {
    long: "Quantity",
    short: "Qty"
  },
  temperature: {
    long: "Temperature",
    short: "Temp"
  },
  baseline: {
    long: "Baseline",
    short: "Baseline"
  },
  profit: {
    long: "Profit",
    short: "Profit"
  }
};
var allAssetNames = {
  ...powerFacilityNames,
  ...storageFacilityNames,
  ...extractionFacilityNames,
  ...functionalFacilityNames,
  ...technologyNames,
  ...resourceNames,
  ...specialNames
};
function getAssetLongName(assetId) {
  return allAssetNames[assetId]?.long ?? assetId;
}

// src/lib/climate-event-config.ts
var CLIMATE_EVENT_CONFIG = {
  flood: { name: "Flood" },
  heat_wave: { name: "Heat wave" },
  cold_wave: { name: "Cold wave" },
  hurricane: { name: "Hurricane" },
  wildfire: { name: "Wildfire" }
};

// src/lib/notification-config.tsx
var NOTIFICATION_CONFIG = {
  construction_finished: {
    category: "projects",
    url: "/app/facilities/manage",
    title: "Construction finished",
    pushBody: (p) => `${getAssetLongName(p.project_type)}${p.level != null ? ` (level ${p.level})` : ""} is now operational.`,
    inGameBody: (p) => `${getAssetLongName(p.project_type)}${p.level != null ? ` (level ${p.level})` : ""} is now operational.`
  },
  technology_researched: {
    category: "projects",
    url: "/app/facilities/technology",
    title: "Research complete",
    pushBody: (p) => `${getAssetLongName(p.technology_type)} level ${p.new_level} unlocked.`,
    inGameBody: (p) => `${getAssetLongName(p.technology_type)} level ${p.new_level} unlocked.`
  },
  facility_decommissioned: {
    category: "projects",
    url: "/app/facilities/manage",
    title: "Facility decommissioned",
    pushBody: (p) => `${getAssetLongName(p.facility_type)} has been decommissioned.`,
    inGameBody: (p) => `${getAssetLongName(p.facility_type)} has been decommissioned.`
  },
  facility_destroyed: {
    category: "events",
    url: "/app/facilities/manage",
    title: "Facility destroyed",
    pushBody: (p) => p.facility_type === "industry" ? `Industry was levelled down by a ${CLIMATE_EVENT_CONFIG[p.event_key].name.toLowerCase()}.` : `${getAssetLongName(p.facility_type)} was destroyed by a ${CLIMATE_EVENT_CONFIG[p.event_key].name.toLowerCase()}.`,
    inGameBody: (p) => p.facility_type === "industry" ? `Industry was levelled down by a ${CLIMATE_EVENT_CONFIG[p.event_key].name.toLowerCase()}.` : `${getAssetLongName(p.facility_type)} was destroyed by a ${CLIMATE_EVENT_CONFIG[p.event_key].name.toLowerCase()}.`
  },
  emergency_facility_created: {
    category: "projects",
    url: "/app/facilities/manage",
    title: "Emergency facility",
    pushBody: (p) => `Your last power facility has been decommissioned. An emergency ${getAssetLongName(p.facility_type)} has been deployed to restart your operations.`,
    inGameBody: (p) => `Your last power facility has been decommissioned. An emergency ${getAssetLongName(p.facility_type)} has been deployed to restart your operations.`
  },
  climate_event: {
    category: "events",
    url: "/app/dashboard",
    title: "Climate event",
    pushBody: (p) => `${CLIMATE_EVENT_CONFIG[p.event_key].name} · ${p.duration_days}d · ${formatMoney(p.cost_per_hour)}$/h`,
    inGameBody: (p) => `${CLIMATE_EVENT_CONFIG[p.event_key].name} · ${p.duration_days}d · ${formatMoney(p.cost_per_hour)}$/h`
  },
  resource_sold: {
    category: "market",
    url: "/app/community/resource-market",
    title: "Resource sold",
    pushBody: (p) => `${p.buyer_username} purchased your ${p.resource}.`,
    inGameBody: (p) => `${p.buyer_username} purchased your ${formatMass(p.quantity_kg)} of your ${p.resource} for a total of ${formatMoney(p.total_price)}$.`
  },
  shipment_arrived: {
    category: "market",
    url: "/app/overviews/resources",
    title: "Shipment arrived",
    pushBody: (p) => `${p.resource}${p.warehouse_full ? " (warehouse full)" : ""}`,
    inGameBody: (p) => `${p.resource}${p.warehouse_full ? " (warehouse full)" : ""}`
  },
  credit_limit_exceeded: {
    category: "market",
    url: "/app/overviews/cash-flow",
    title: "Credit limit exceeded",
    pushBody: () => "Not enough money for market participation.",
    inGameBody: () => "Not enough money for market participation."
  },
  achievement_milestone: {
    category: "achievements",
    url: "/app/dashboard",
    title: "Achievement unlocked",
    pushBody: (p) => {
      const body = ACHIEVEMENT_MILESTONE_CONFIG[p.achievement_key].body(p);
      return `${body} (+${p.xp} XP)`;
    },
    inGameBody: (p) => {
      const body = ACHIEVEMENT_MILESTONE_CONFIG[p.achievement_key].body(p);
      return `${body} (+${p.xp} XP)`;
    }
  },
  achievement_unlock: {
    category: "achievements",
    url: "/app/dashboard",
    title: "Achievement unlocked",
    pushBody: (p) => `${ACHIEVEMENT_UNLOCK_CONFIG[p.achievement_key].body} (+${p.xp} XP)`,
    inGameBody: (p) => `${ACHIEVEMENT_UNLOCK_CONFIG[p.achievement_key].body} (+${p.xp} XP)`
  },
  push_notification_test: {
    category: "events",
    url: "/app/dashboard",
    title: "Push notification test",
    pushBody: () => "If you see this, browser push notifications are working.",
    inGameBody: () => "If you see this, browser push notifications are working."
  }
};
var getDef = (type) => NOTIFICATION_CONFIG[type];
function getNotificationPushText(payload) {
  const def = getDef(payload.type);
  return { title: def.title, body: def.pushBody(payload) };
}
function getNotificationUrl(type) {
  return NOTIFICATION_CONFIG[type].url;
}

// src/service-worker.ts
var sw = self;
sw.addEventListener("push", (event) => {
  if (!event.data)
    return;
  const data = event.data.json();
  const payload = { type: data.type, ...data.payload };
  const { title, body } = getNotificationPushText(payload);
  const url = getNotificationUrl(data.type);
  event.waitUntil(sw.registration.showNotification(title, {
    body,
    icon: "/static/images/icon_green.png",
    data: { url }
  }));
});
sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url ?? "/app/overview";
  event.waitUntil(sw.clients.openWindow(sw.location.origin + path));
});
