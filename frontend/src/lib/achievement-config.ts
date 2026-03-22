import { formatAchievementValue } from "@/lib/format-utils";
import type { NotificationPayload } from "@/types/notifications";

// ---------------------------------------------------------------------------
// Payload type aliases
// ---------------------------------------------------------------------------

type MilestonePayload = Extract<NotificationPayload, { type: "achievement_milestone" }>;
type UnlockPayload = Extract<NotificationPayload, { type: "achievement_unlock" }>;

export type MilestoneAchievementKey = MilestonePayload["achievement_key"];
export type UnlockAchievementKey = UnlockPayload["achievement_key"];

// ---------------------------------------------------------------------------
// Per-achievement comparison labels
// ---------------------------------------------------------------------------

export type PowerConsumptionComparisonKey = Extract<
    MilestonePayload,
    { achievement_key: "power_consumption" }
>["comparison_key"];

export type EnergyStorageComparisonKey = Extract<
    MilestonePayload,
    { achievement_key: "energy_storage" }
>["comparison_key"];

export const POWER_CONSUMPTION_COMPARISON_LABELS: Record<PowerConsumptionComparisonKey, string> = {
    "village-in-europe": "a village in Europe",
    "city-of-basel": "the city of Basel",
    switzerland: "Switzerland",
    japan: "Japan",
    "world-population": "the entire world population",
};

export const ENERGY_STORAGE_COMPARISON_LABELS: Record<EnergyStorageComparisonKey, string> = {
    "zurich-for-a-day": "Zurich for a day",
    "switzerland-for-a-day": "Switzerland for a day",
    "switzerland-for-a-month": "Switzerland for a month",
};

// ---------------------------------------------------------------------------
// Achievement config types
// ---------------------------------------------------------------------------

type MilestoneConfig<K extends MilestoneAchievementKey> = {
    name: string;
    body: (p: Extract<MilestonePayload, { achievement_key: K }>) => string;
};

type UnlockConfig = {
    name: string;
    body: string;
};

// ---------------------------------------------------------------------------
// Milestone achievement config — one entry per achievement_key.
// TypeScript will error if any key is missing or has the wrong payload type.
// ---------------------------------------------------------------------------

type PCPayload = Extract<MilestonePayload, { achievement_key: "power_consumption" }>;
type ESPayload = Extract<MilestonePayload, { achievement_key: "energy_storage" }>;
type BasePayload = Exclude<MilestonePayload, { comparison_key: string }>;

export const ACHIEVEMENT_MILESTONE_CONFIG = {
    power_consumption: {
        name: "Power Consumption",
        body: (p: PCPayload) =>
            `You have passed the milestone of ${formatAchievementValue(p.threshold, "power_consumption")} of power consumption. You consume as much electricity as ${POWER_CONSUMPTION_COMPARISON_LABELS[p.comparison_key]}.`,
    },
    energy_storage: {
        name: "Energy Storage",
        body: (p: ESPayload) =>
            `You have stored ${formatAchievementValue(p.threshold, "energy_storage")} of energy, enough to power ${ENERGY_STORAGE_COMPARISON_LABELS[p.comparison_key]}.`,
    },
    mineral_extraction: {
        name: "Mineral Extraction",
        body: (p: BasePayload) =>
            `You have extracted ${formatAchievementValue(p.threshold, "mineral_extraction")} of resources.`,
    },
    network_import: {
        name: "Network Import",
        body: (p: BasePayload) =>
            `You have imported more than ${formatAchievementValue(p.threshold, "network_import")} on the market.`,
    },
    network_export: {
        name: "Network Export",
        body: (p: BasePayload) =>
            `You have exported more than ${formatAchievementValue(p.threshold, "network_export")} on the market.`,
    },
    network: {
        name: "Unlock Network",
        body: (_p: BasePayload) =>
            "Your generation capacities are now big enough to join a network and trade electricity. See Community > Network.",
    },
    technology: {
        name: "Technology",
        body: (p: BasePayload) =>
            `You have researched a total of ${p.threshold} levels of technologies.`,
    },
    trading_export: {
        name: "Resource Export",
        body: (p: BasePayload) =>
            `You have exported more than ${formatAchievementValue(p.threshold, "trading_export")} of resources.`,
    },
    trading_import: {
        name: "Resource Import",
        body: (p: BasePayload) =>
            `You have imported more than ${formatAchievementValue(p.threshold, "trading_import")} of resources.`,
    },
} satisfies { [K in MilestoneAchievementKey]: MilestoneConfig<K> };

// ---------------------------------------------------------------------------
// Unlock achievement config — one entry per achievement_key.
// ---------------------------------------------------------------------------

export const ACHIEVEMENT_UNLOCK_CONFIG: Record<UnlockAchievementKey, UnlockConfig> = {
    laboratory: {
        name: "Unlock Technologies",
        body: "You have built a laboratory, you can now research technologies to unlock new facilities or improve existing ones.",
    },
    warehouse: {
        name: "Unlock Natural Resources",
        body: "You have built a warehouse to store natural resources, you can now buy resources on the resource market or extract them yourself by building extraction facilities.",
    },
    storage_facilities: {
        name: "First Storage Facility",
        body: "You have built your first storage facility, you can monitor the stored energy in the energy storage overview.",
    },
    GHG_effect: {
        name: "Discover the Greenhouse Effect",
        body: "Scientists have discovered the greenhouse effect and have shown that climate change is caused by human activities and increases the risk of extreme weather events. You can now monitor your CO2 emissions and the climate anomalies in the emissions overview.",
    },
};
