/** Notifications-related API calls. Handles game notification functionality. */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse, ApiRequestBody, ApiSchema } from "@/types/api-helpers";

export const notificationsApi = {
    /** Get all notifications for the current user. */
    getNotifications: () =>
        apiClient.get<ApiResponse<"/api/v1/notifications", "get">>(
            "/notifications",
        ),

    /** Delete a notification. */
    deleteNotification: (notificationId: number) =>
        apiClient.delete<
            ApiResponse<"/api/v1/notifications/{notification_id}", "delete">
        >(`/notifications/${notificationId}`),

    /** Mark all notifications as read. */
    markAllRead: () =>
        apiClient.post<
            ApiResponse<"/api/v1/notifications:markAllRead", "post">
        >("/notifications:markAllRead"),

    /** Patch a notification's read/flagged/archived state. */
    patchNotification: (
        notificationId: number,
        body: ApiRequestBody<
            "/api/v1/notifications/{notification_id}",
            "patch"
        >,
    ) =>
        apiClient.patch<
            ApiResponse<"/api/v1/notifications/{notification_id}", "patch">
        >(`/notifications/${notificationId}`, body),

    /** Get notification subscription preferences. */
    getSubscriptionPrefs: () =>
        apiClient.get<
            ApiResponse<
                "/api/v1/notifications/subscription-prefs",
                "get"
            >
        >("/notifications/subscription-prefs"),

    /** Patch notification subscription preferences. */
    patchSubscriptionPrefs: (
        body: ApiSchema<"NotificationSubscriptionPrefsIn">,
    ) =>
        apiClient.patch<
            ApiResponse<
                "/api/v1/notifications/subscription-prefs",
                "patch"
            >
        >("/notifications/subscription-prefs", body),
};
