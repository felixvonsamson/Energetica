import type { components } from "@/types/api.generated";

export type ClimateEventKey = components["schemas"]["ClimateEventType"];

type ClimateEventConfig = {
    /** Display name for the climate event. Used in:
     *  - notification-config.tsx pushBody: browser push notification (service worker)
     *  - notification-config.tsx inGameBody: in-game notification panel */
    name: string;
};

export const CLIMATE_EVENT_CONFIG: Record<ClimateEventKey, ClimateEventConfig> = {
    flood: { name: "Flood" },
    heat_wave: { name: "Heat wave" },
    cold_wave: { name: "Cold wave" },
    hurricane: { name: "Hurricane" },
    wildfire: { name: "Wildfire" },
};
