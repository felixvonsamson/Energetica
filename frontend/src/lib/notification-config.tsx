import type { ReactNode } from "react";

import { formatAchievementValue } from "@/lib/format-utils";
import type { AppRoute } from "@/types/app-routes";
import type {
    NotificationCategory,
    NotificationPayload,
    NotificationPayloadOf,
    NotificationType,
} from "@/types/notifications";

type PowerConsumptionComparisonKey = Extract<
    NotificationPayload,
    { achievement_key: "power_consumption" }
>["comparison_key"];
type EnergyStorageComparisonKey = Extract<
    NotificationPayload,
    { achievement_key: "energy_storage" }
>["comparison_key"];

const POWER_CONSUMPTION_COMPARISON_LABELS: Record<PowerConsumptionComparisonKey, string> = {
    "village-in-europe": "a village in Europe",
    "city-of-basel": "the city of Basel",
    switzerland: "Switzerland",
    japan: "Japan",
    "world-population": "the entire world population",
};

const ENERGY_STORAGE_COMPARISON_LABELS: Record<EnergyStorageComparisonKey, string> = {
    "zurich-for-a-day": "Zurich for a day",
    "switzerland-for-a-day": "Switzerland for a day",
    "switzerland-for-a-month": "Switzerland for a month",
};

type NotificationDef<T extends NotificationType> = {
    category: NotificationCategory;
    url: AppRoute;
    title: string;
    pushBody: (payload: NotificationPayloadOf<T>) => string;
    inGameBody: (payload: NotificationPayloadOf<T>) => ReactNode;
};

const NOTIFICATION_CONFIG = {
    construction_finished: {
        category: "projects",
        url: "/app/facilities/manage",
        title: "Construction finished",
        pushBody: (p) =>
            `${p.project_name}${p.level != null ? ` (level ${p.level})` : ""} is now operational.`,
        inGameBody: (p) =>
            `${p.project_name}${p.level != null ? ` (level ${p.level})` : ""} is now operational.`,
    },
    technology_researched: {
        category: "projects",
        url: "/app/facilities/technology",
        title: "Research complete",
        pushBody: (p) => `${p.technology_name} level ${p.new_level} unlocked.`,
        inGameBody: (p) => `${p.technology_name} level ${p.new_level} unlocked.`,
    },
    facility_decommissioned: {
        category: "projects",
        url: "/app/facilities/manage",
        title: "Facility decommissioned",
        pushBody: (p) => `${p.facility_name} has been decommissioned.`,
        inGameBody: (p) => `${p.facility_name} has been decommissioned.`,
    },
    facility_destroyed: {
        category: "events",
        url: "/app/facilities/manage",
        title: "Facility destroyed",
        pushBody: (p) => `${p.facility_name} was destroyed by ${p.event_name}.`,
        inGameBody: (p) => `${p.facility_name} was destroyed by ${p.event_name}.`,
    },
    emergency_facility_created: {
        category: "projects",
        url: "/app/facilities/manage",
        title: "Emergency facility",
        pushBody: (p) => `A ${p.facility_name} was created automatically.`,
        inGameBody: (p) => `A ${p.facility_name} was created automatically.`,
    },
    climate_event: {
        category: "events",
        // TODO: redirect to a future "news" page; no logical destination for now
        url: "/app/dashboard",
        title: "Climate event",
        pushBody: (p) => `${p.event_name} · ${p.duration_days}d · ${p.cost_per_hour}`,
        inGameBody: (p) => `${p.event_name} · ${p.duration_days}d · ${p.cost_per_hour}`,
    },
    resource_sold: {
        category: "market",
        url: "/app/community/resource-market",
        title: "Resource sold",
        pushBody: (p) => `${p.buyer_username} purchased your ${p.resource}.`,
        inGameBody: (p) => `${p.buyer_username} purchased your ${p.resource}.`,
    },
    shipment_arrived: {
        category: "market",
        url: "/app/overviews/resources",
        title: "Shipment arrived",
        pushBody: (p) => `${p.resource}${p.warehouse_full ? " (warehouse full)" : ""}`,
        inGameBody: (p) => `${p.resource}${p.warehouse_full ? " (warehouse full)" : ""}`,
    },
    credit_limit_exceeded: {
        category: "market",
        url: "/app/overviews/cash-flow",
        title: "Credit limit exceeded",
        pushBody: () => "Not enough money for market participation.",
        inGameBody: () => "Not enough money for market participation.",
    },
    achievement_milestone: {
        category: "achievements",
        // TODO: redirect to a dedicated achievements page when it exists
        url: "/app/dashboard",
        title: "Achievement unlocked",
        pushBody: (p) => {
            const value = formatAchievementValue(p.threshold, p.achievement_key);
            let comparison = "";
            if (p.achievement_key === "power_consumption") {
                comparison = ` — like ${POWER_CONSUMPTION_COMPARISON_LABELS[p.comparison_key]}`;
            } else if (p.achievement_key === "energy_storage") {
                comparison = ` — like ${ENERGY_STORAGE_COMPARISON_LABELS[p.comparison_key]}`;
            }
            return `${value}${comparison} (+${p.xp} XP)`;
        },
        inGameBody: (p) => {
            const value = formatAchievementValue(p.threshold, p.achievement_key);
            let comparison = "";
            if (p.achievement_key === "power_consumption") {
                comparison = ` — like ${POWER_CONSUMPTION_COMPARISON_LABELS[p.comparison_key]}`;
            } else if (p.achievement_key === "energy_storage") {
                comparison = ` — like ${ENERGY_STORAGE_COMPARISON_LABELS[p.comparison_key]}`;
            }
            return `${value}${comparison} (+${p.xp} XP)`;
        },
    },
    achievement_unlock: {
        category: "achievements",
        // TODO: redirect to a dedicated achievements page when it exists
        url: "/app/dashboard",
        title: "Achievement unlocked",
        pushBody: (p) => `+${p.xp} XP`,
        inGameBody: (p) => `+${p.xp} XP`,
    },
} satisfies { [T in NotificationType]: NotificationDef<T> };

// Widen the payload-specific function signatures so callers can pass any NotificationPayload.
// Safe because the discriminant on NotificationPayload guarantees the right variant is passed.
type AnyNotificationDef = {
    category: NotificationCategory;
    url: AppRoute;
    title: string;
    pushBody: (payload: NotificationPayload) => string;
    inGameBody: (payload: NotificationPayload) => ReactNode;
};
const getDef = (type: NotificationType) =>
    NOTIFICATION_CONFIG[type] as unknown as AnyNotificationDef;

export function getNotificationPushText(payload: NotificationPayload): { title: string; body: string } {
    const def = getDef(payload.type);
    return { title: def.title, body: def.pushBody(payload) };
}

export function getNotificationUrl(type: NotificationType): AppRoute {
    return NOTIFICATION_CONFIG[type].url;
}

export function getNotificationCategory(type: NotificationType): NotificationCategory {
    return NOTIFICATION_CONFIG[type].category;
}

export function getNotificationContent(payload: NotificationPayload): { title: string; body: ReactNode } {
    const def = getDef(payload.type);
    return { title: def.title, body: def.inGameBody(payload) };
}
