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

export type NotificationCategory =
    | "projects"
    | "market"
    | "events"
    | "achievements";

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
    projects: "Projects",
    market: "Market",
    events: "Events",
    achievements: "Achievements",
};
