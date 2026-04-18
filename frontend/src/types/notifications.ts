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

// ---------------------------------------------------------------------------
// Inbox categories — used for filtering the in-game notification inbox.
// These only include types that create persistent Notification records.
// ---------------------------------------------------------------------------

export type InboxCategory =
    | "projects"
    | "market"
    | "events"
    | "achievements";

export const INBOX_CATEGORY_LABELS: Record<InboxCategory, string> = {
    projects: "Projects",
    market: "Market",
    events: "Events",
    achievements: "Achievements",
};

// ---------------------------------------------------------------------------
// Push categories — used for browser push notification opt-in/opt-out.
// Superset of inbox categories, plus push-only categories like chat.
// ---------------------------------------------------------------------------

export type PushCategory = InboxCategory | "chat" | "quiz";

export const PUSH_CATEGORY_LABELS: Record<PushCategory, string> = {
    chat: "Chat messages",
    quiz: "Daily quiz",
    projects: "Projects",
    market: "Market",
    events: "Events",
    achievements: "Achievements",
};
