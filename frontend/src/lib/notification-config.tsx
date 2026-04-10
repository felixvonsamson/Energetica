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
    InboxCategory,
    NotificationPayload,
    NotificationPayloadOf,
    NotificationType,
    PushCategory,
} from "@/types/notifications";

type AppPath = AppRoute | `${AppRoute}?${string}`;

// ---------------------------------------------------------------------------
// Inbox notification config — only types that create persistent records.
// Used by the notification popup to render inbox items.
// ---------------------------------------------------------------------------

type InboxNotificationDef<T extends NotificationType> = {
    category: InboxCategory;
    path: (payload: NotificationPayloadOf<T>) => AppPath;
    title: string;
    pushBody: (payload: NotificationPayloadOf<T>) => string;
    inGameBody: (payload: NotificationPayloadOf<T>) => ReactNode;
};

const INBOX_NOTIFICATION_CONFIG = {
    construction_finished: {
        category: "projects",
        path: () => "/app/facilities/manage",
        title: "Construction finished",
        pushBody: (p) =>
            `${getAssetLongName(p.project_type)}${p.level != null ? ` (level ${p.level})` : ""} is now operational.`,
        inGameBody: (p) =>
            `${getAssetLongName(p.project_type)}${p.level != null ? ` (level ${p.level})` : ""} is now operational.`,
    },
    technology_researched: {
        category: "projects",
        path: () => "/app/facilities/technology",
        title: "Research complete",
        pushBody: (p) =>
            `${getAssetLongName(p.technology_type)} level ${p.new_level} unlocked.`,
        inGameBody: (p) =>
            `${getAssetLongName(p.technology_type)} level ${p.new_level} unlocked.`,
    },
    facility_decommissioned: {
        category: "projects",
        path: () => "/app/facilities/manage",
        title: "Facility decommissioned",
        pushBody: (p) =>
            `${getAssetLongName(p.facility_type)} has been decommissioned.`,
        inGameBody: (p) =>
            `${getAssetLongName(p.facility_type)} has been decommissioned.`,
    },
    facility_destroyed: {
        category: "events",
        path: () => "/app/facilities/manage",
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
        path: () => "/app/facilities/manage",
        title: "Emergency facility",
        pushBody: (p) =>
            `Your last power facility has been decommissioned. An emergency ${getAssetLongName(p.facility_type)} has been deployed to restart your operations.`,
        inGameBody: (p) =>
            `Your last power facility has been decommissioned. An emergency ${getAssetLongName(p.facility_type)} has been deployed to restart your operations.`,
    },
    climate_event: {
        category: "events",
        // TODO: redirect to a future "news" page; no logical destination for now
        path: () => "/app/dashboard",
        title: "Climate event",
        pushBody: (p) =>
            `A ${CLIMATE_EVENT_CONFIG[p.event_key].name} occurred on your tile that might have affected your facilities. The cleanup after this event will last ${p.duration_days} days and cost ${formatMoney(p.cost_per_hour * 24)} per in-game day`,
        inGameBody: (p) =>
            `A ${CLIMATE_EVENT_CONFIG[p.event_key].name} occurred on your tile that might have affected your facilities. The cleanup after this event will last ${p.duration_days} days and cost ${formatMoney(p.cost_per_hour * 24)} per in-game day`,
    },
    resource_sold: {
        category: "market",
        path: () => "/app/community/resource-market",
        title: "Resource sold",
        pushBody: (p) =>
            `${p.buyer_username} purchased ${formatMass(p.quantity_kg)} of your ${p.resource} for a total of ${formatMoney(p.total_price)}.`,
        inGameBody: (p) =>
            `${p.buyer_username} purchased ${formatMass(p.quantity_kg)} of your ${p.resource} for a total of ${formatMoney(p.total_price)}.`,
    },
    shipment_arrived: {
        category: "market",
        path: () => "/app/overviews/resources",
        title: "Shipment arrived",
        pushBody: (p) =>
            p.warehouse_full
                ? `Your shipment of ${p.resource} has arrived, but only ${formatMass(p.stored_kg)} of ${formatMass(p.quantity_kg)} were stored, since your warehouse ran out of storage capacity.`
                : `Your ${formatMass(p.quantity_kg)} shipment of ${p.resource} has arrived.`,
        inGameBody: (p) =>
            p.warehouse_full
                ? `Your shipment of ${p.resource} has arrived, but only ${formatMass(p.stored_kg)} of ${formatMass(p.quantity_kg)} were stored, since your warehouse ran out of storage capacity.`
                : `Your ${formatMass(p.quantity_kg)} shipment of ${p.resource} has arrived.`,
    },
    network_expelled: {
        category: "market",
        path: () => "/app/community/electricity-markets",
        title: "Expelled from network",
        pushBody: (p) =>
            `You have been expelled from ${p.network_name} due to insufficient funds. Recover a positive balance to rejoin.`,
        inGameBody: (p) =>
            `You have been expelled from ${p.network_name} due to insufficient funds. Recover a positive balance to rejoin.`,
    },
    achievement_milestone: {
        category: "achievements",
        // TODO: redirect to a dedicated achievements page when it exists
        path: () => "/app/dashboard",
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
        path: () => "/app/dashboard",
        title: "Achievement unlocked",
        pushBody: (p) =>
            `${ACHIEVEMENT_UNLOCK_CONFIG[p.achievement_key].body} (+${p.xp} XP)`,
        inGameBody: (p) =>
            `${ACHIEVEMENT_UNLOCK_CONFIG[p.achievement_key].body} (+${p.xp} XP)`,
    },
} satisfies { [T in NotificationType]: InboxNotificationDef<T> };

// ---------------------------------------------------------------------------
// Push notification config — all types that can trigger a browser push,
// including push-only types (chat, test) that have no inbox entry.
// ---------------------------------------------------------------------------

// Push-only types are not in the generated API types since they don't appear
// in the inbox API. We define their payload shapes manually here.
type ChatMessagePushPayload = {
    type: "chat_message";
    sender_username: string;
    message: string;
    chat_id: number;
};

type PushNotificationTestPushPayload = {
    type: "push_notification_test";
};

type PushOnlyPayload = ChatMessagePushPayload | PushNotificationTestPushPayload;

// All payloads the service worker may receive.
export type AnyPushPayload = NotificationPayload | PushOnlyPayload;

type PushNotificationDef<P> = {
    pushCategory: PushCategory;
    path: (payload: P) => string;
    title: string;
    pushBody: (payload: P) => string;
};

const PUSH_ONLY_CONFIG = {
    chat_message: {
        pushCategory: "chat",
        path: (p: ChatMessagePushPayload) =>
            `/app/community/messages?selectedChatId=${p.chat_id}`,
        title: "New message",
        pushBody: (p: ChatMessagePushPayload) =>
            `${p.sender_username}: ${p.message}`,
    },
    push_notification_test: {
        pushCategory: "events",
        path: () => "/app/dashboard",
        title: "Push notification test",
        pushBody: () =>
            "If you see this, browser push notifications are working.",
    },
} satisfies Record<string, PushNotificationDef<never>>;

// Build a merged lookup for the service worker.
// Inbox types inherit their push config from the inbox config.
const PUSH_CONFIG_FROM_INBOX: Record<
    string,
    PushNotificationDef<never>
> = Object.fromEntries(
    Object.entries(INBOX_NOTIFICATION_CONFIG).map(([type, def]) => [
        type,
        {
            pushCategory: def.category,
            path: def.path,
            title: def.title,
            pushBody: def.pushBody,
        } as PushNotificationDef<never>,
    ]),
);

const FULL_PUSH_CONFIG: Record<string, PushNotificationDef<never>> = {
    ...PUSH_CONFIG_FROM_INBOX,
    ...PUSH_ONLY_CONFIG,
};

// ---------------------------------------------------------------------------
// Public API — used by the notification popup (inbox) and service worker (push).
// ---------------------------------------------------------------------------

// Widen the payload-specific function signatures so callers can pass any NotificationPayload.
type AnyInboxDef = {
    category: InboxCategory;
    path: (payload: NotificationPayload) => AppPath;
    title: string;
    pushBody: (payload: NotificationPayload) => string;
    inGameBody: (payload: NotificationPayload) => ReactNode;
};
const getInboxDef = (type: NotificationType) =>
    INBOX_NOTIFICATION_CONFIG[type] as unknown as AnyInboxDef;

/** Get the inbox category for a notification type (inbox items only). */
export function getNotificationCategory(
    type: NotificationType,
): InboxCategory {
    return INBOX_NOTIFICATION_CONFIG[type].category;
}

/** Get the title and body for rendering an inbox notification. */
export function getNotificationContent(payload: NotificationPayload): {
    title: string;
    body: ReactNode;
} {
    const def = getInboxDef(payload.type);
    return { title: def.title, body: def.inGameBody(payload) };
}

/** Get the push category for any push payload (inbox or push-only). */
export function getPushCategory(type: string): PushCategory {
    return (FULL_PUSH_CONFIG[type]?.pushCategory ?? "events") as PushCategory;
}

/** Get push notification title and body for any push payload. */
export function getPushText(payload: AnyPushPayload): {
    title: string;
    body: string;
} {
    const def = FULL_PUSH_CONFIG[payload.type];
    if (!def) return { title: "Energetica", body: "" };
    const pushBody = def.pushBody as (payload: AnyPushPayload) => string;
    return { title: def.title, body: pushBody(payload) };
}

/** Get the navigation path for any push payload. */
export function getPushPath(payload: AnyPushPayload): string {
    const def = FULL_PUSH_CONFIG[payload.type];
    if (!def) return "/app/dashboard";
    const path = def.path as (payload: AnyPushPayload) => string;
    return path(payload);
}

/** Map from inbox notification type to its inbox category. */
export const INBOX_TYPE_TO_CATEGORY = Object.fromEntries(
    Object.entries(INBOX_NOTIFICATION_CONFIG).map(([type, def]) => [
        type,
        def.category,
    ]),
) as Record<NotificationType, InboxCategory>;
