import type { ReactNode } from "react";

import {
    ACHIEVEMENT_MILESTONE_CONFIG,
    ACHIEVEMENT_UNLOCK_CONFIG,
} from "@/lib/achievement-config";
import { getAssetLongName } from "@/lib/assets/asset-names";
import { CLIMATE_EVENT_CONFIG } from "@/lib/climate-event-config";
import { formatMass, formatMoney } from "@/lib/format-utils";
import type { AppRoute } from "@/types/app-routes";
import type {
    NotificationCategory,
    NotificationPayload,
    NotificationPayloadOf,
    NotificationType,
} from "@/types/notifications";

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
            `${getAssetLongName(p.project_type)}${p.level != null ? ` (level ${p.level})` : ""} is now operational.`,
        inGameBody: (p) =>
            `${getAssetLongName(p.project_type)}${p.level != null ? ` (level ${p.level})` : ""} is now operational.`,
    },
    technology_researched: {
        category: "projects",
        url: "/app/facilities/technology",
        title: "Research complete",
        pushBody: (p) =>
            `${getAssetLongName(p.technology_type)} level ${p.new_level} unlocked.`,
        inGameBody: (p) =>
            `${getAssetLongName(p.technology_type)} level ${p.new_level} unlocked.`,
    },
    facility_decommissioned: {
        category: "projects",
        url: "/app/facilities/manage",
        title: "Facility decommissioned",
        pushBody: (p) =>
            `${getAssetLongName(p.facility_type)} has been decommissioned.`,
        inGameBody: (p) =>
            `${getAssetLongName(p.facility_type)} has been decommissioned.`,
    },
    facility_destroyed: {
        category: "events",
        url: "/app/facilities/manage",
        title: "Facility destroyed",
        pushBody: (p) =>
            p.facility_type === "industry"
                ? `Industry was levelled down by a ${CLIMATE_EVENT_CONFIG[p.event_key].name.toLowerCase()}.`
                : `${getAssetLongName(p.facility_type)} was destroyed by a ${CLIMATE_EVENT_CONFIG[p.event_key].name.toLowerCase()}.`,
        inGameBody: (p) =>
            p.facility_type === "industry"
                ? `Industry was levelled down by a ${CLIMATE_EVENT_CONFIG[p.event_key].name.toLowerCase()}.`
                : `${getAssetLongName(p.facility_type)} was destroyed by a ${CLIMATE_EVENT_CONFIG[p.event_key].name.toLowerCase()}.`,
    },
    emergency_facility_created: {
        category: "projects",
        url: "/app/facilities/manage",
        title: "Emergency facility",
        pushBody: (p) =>
            `Your last power facility has been decommissioned. An emergency ${getAssetLongName(p.facility_type)} has been deployed to restart your operations.`,
        inGameBody: (p) =>
            `Your last power facility has been decommissioned. An emergency ${getAssetLongName(p.facility_type)} has been deployed to restart your operations.`,
    },
    climate_event: {
        category: "events",
        // TODO: redirect to a future "news" page; no logical destination for now
        url: "/app/dashboard",
        title: "Climate event",
        pushBody: (p) =>
            `A ${CLIMATE_EVENT_CONFIG[p.event_key].name} occurred on your tile that might have affected your facilities. The cleanup after this event will last ${p.duration_days} days and cost ${formatMoney(p.cost_per_hour * 24)} per in-game day`,
        inGameBody: (p) =>
            `A ${CLIMATE_EVENT_CONFIG[p.event_key].name} occurred on your tile that might have affected your facilities. The cleanup after this event will last ${p.duration_days} days and cost ${formatMoney(p.cost_per_hour * 24)} per in-game day`,
    },
    resource_sold: {
        category: "market",
        url: "/app/community/resource-market",
        title: "Resource sold",
        pushBody: (p) =>
            `${p.buyer_username} purchased ${formatMass(p.quantity_kg)} of your ${p.resource} for a total of ${formatMoney(p.total_price)}.`,
        inGameBody: (p) =>
            `${p.buyer_username} purchased ${formatMass(p.quantity_kg)} of your ${p.resource} for a total of ${formatMoney(p.total_price)}.`,
    },
    shipment_arrived: {
        category: "market",
        url: "/app/overviews/resources",
        title: "Shipment arrived",
        pushBody: (p) =>
            p.warehouse_full
                ? `Your shipment of ${p.resource} has arrived, but only ${formatMass(p.stored_kg)} of ${formatMass(p.stored_kg)} were stored, since your warehouse ran out of storage capacity.`
                : `Your ${formatMass(p.quantity_kg)} shipment of ${p.resource} has arrived.`,
        inGameBody: (p) =>
            p.warehouse_full
                ? `Your shipment of ${p.resource} has arrived, but only ${formatMass(p.stored_kg)} of ${formatMass(p.stored_kg)} were stored, since your warehouse ran out of storage capacity.`
                : `Your ${formatMass(p.quantity_kg)} shipment of ${p.resource} has arrived.`,
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
            // Safe: achievement_key discriminates the correct config entry and payload type.
            const body = (
                ACHIEVEMENT_MILESTONE_CONFIG[p.achievement_key].body as (
                    p: never,
                ) => string
            )(p as never);
            return `${body} (+${p.xp} XP)`;
        },
        inGameBody: (p) => {
            const body = (
                ACHIEVEMENT_MILESTONE_CONFIG[p.achievement_key].body as (
                    p: never,
                ) => string
            )(p as never);
            return `${body} (+${p.xp} XP)`;
        },
    },
    achievement_unlock: {
        category: "achievements",
        // TODO: redirect to a dedicated achievements page when it exists
        url: "/app/dashboard",
        title: "Achievement unlocked",
        pushBody: (p) =>
            `${ACHIEVEMENT_UNLOCK_CONFIG[p.achievement_key].body} (+${p.xp} XP)`,
        inGameBody: (p) =>
            `${ACHIEVEMENT_UNLOCK_CONFIG[p.achievement_key].body} (+${p.xp} XP)`,
    },
    push_notification_test: {
        category: "events",
        url: "/app/dashboard",
        title: "Push notification test",
        pushBody: () =>
            "If you see this, browser push notifications are working.",
        inGameBody: () =>
            "If you see this, browser push notifications are working.",
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

export function getNotificationPushText(payload: NotificationPayload): {
    title: string;
    body: string;
} {
    const def = getDef(payload.type);
    return { title: def.title, body: def.pushBody(payload) };
}

export function getNotificationUrl(type: NotificationType): AppRoute {
    return NOTIFICATION_CONFIG[type].url;
}

export function getNotificationCategory(
    type: NotificationType,
): NotificationCategory {
    return NOTIFICATION_CONFIG[type].category;
}

export function getNotificationContent(payload: NotificationPayload): {
    title: string;
    body: ReactNode;
} {
    const def = getDef(payload.type);
    return { title: def.title, body: def.inGameBody(payload) };
}
