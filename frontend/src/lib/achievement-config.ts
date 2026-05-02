import { formatEnergy, formatMass, formatPower } from "@/lib/format-utils";
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
    /** Display name for the achievement. Used in:
     *  - AchievementCard: progress card on the dashboard, with the 1-based
     *    milestone level appended (e.g. "Power Consumption 2") */
    name: string;
    /** Formats the achievement's numeric values (status, objective, threshold)
     *  into a human-readable string with units. Used in:
     *  - AchievementCard: progress bar label (e.g. "12 GWh / 50 GWh")
     *  - body: called directly to format the threshold in notification text */
    format: (v: number) => string;
    /** Generates the notification body text for a milestone event. Used in:
     *  - notification-config.tsx pushBody: browser push notification (service worker)
     *  - notification-config.tsx inGameBody: in-game notification panel
     *  Currently returns a plain string; could become a ReactNode in the future
     *  to enable richer in-game formatting (links, highlights, etc.). */
    body: (p: Extract<MilestonePayload, { achievement_key: K }>) => string;
};

type UnlockConfig = {
    /** Display name for the achievement. Used in:
     *  - AchievementCard: progress card on the dashboard */
    name: string;
    /** Notification body text for when the unlock is triggered. Used in:
     *  - notification-config.tsx pushBody: browser push notification (service worker)
     *  - notification-config.tsx inGameBody: in-game notification panel
     *  Static string (no payload needed). Could become a ReactNode in the future. */
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
        format: formatPower,
        body: (p: PCPayload) =>
            `You have passed the milestone of ${formatPower(p.threshold)} of power consumption. You consume as much electricity as ${POWER_CONSUMPTION_COMPARISON_LABELS[p.comparison_key]}.`,
    },
    energy_storage: {
        name: "Energy Storage",
        format: formatEnergy,
        body: (p: ESPayload) =>
            `You have stored ${formatEnergy(p.threshold)} of energy, enough to power ${ENERGY_STORAGE_COMPARISON_LABELS[p.comparison_key]}.`,
    },
    mineral_extraction: {
        name: "Mineral Extraction",
        format: formatMass,
        body: (p: BasePayload) =>
            `You have extracted ${formatMass(p.threshold)} of resources.`,
    },
    network_import: {
        name: "Network Import",
        format: formatEnergy,
        body: (p: BasePayload) =>
            `You have imported more than ${formatEnergy(p.threshold)} on the market.`,
    },
    network_export: {
        name: "Network Export",
        format: formatEnergy,
        body: (p: BasePayload) =>
            `You have exported more than ${formatEnergy(p.threshold)} on the market.`,
    },
    network: {
        name: "Unlock Network",
        format: formatPower,
        body: (_p: BasePayload) =>
            "Your generation capacities are now big enough to join a network and trade electricity. See Community > Network.",
    },
    technology: {
        name: "Technology",
        format: (v: number) => v.toString(),
        body: (p: BasePayload) =>
            `You have researched a total of ${p.threshold} levels of technologies.`,
    },
    trading_export: {
        name: "Resource Export",
        format: formatMass,
        body: (p: BasePayload) =>
            `You have exported more than ${formatMass(p.threshold)} of resources.`,
    },
    trading_import: {
        name: "Resource Import",
        format: formatMass,
        body: (p: BasePayload) =>
            `You have imported more than ${formatMass(p.threshold)} of resources.`,
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
};
