import type { ApiSchema } from "./api-helpers";

export type NotificationListResponse = ApiSchema<"NotificationListOut">;
export type Notification = ApiSchema<"NotificationOut">;
export type NotificationPayload = Notification["payload"];
export type NotificationType = NotificationPayload["type"];

// Extract a specific payload variant by discriminant
export type NotificationPayloadOf<T extends NotificationType> = Extract<
    NotificationPayload,
    { type: T }
>;

// Frontend-only category mapping
export type NotificationCategory =
    | "projects"
    | "market"
    | "events"
    | "achievements";

export const NOTIFICATION_CATEGORIES: Record<
    NotificationType,
    NotificationCategory
> = {
    construction_finished: "projects",
    technology_researched: "projects",
    facility_decommissioned: "projects",
    facility_destroyed: "events",
    emergency_facility_created: "projects",
    climate_event: "events",
    resource_sold: "market",
    shipment_arrived: "market",
    credit_limit_exceeded: "market",
    achievement_unlocked: "achievements",
};

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
    projects: "Projects",
    market: "Market",
    events: "Events",
    achievements: "Achievements",
};
