/** Notifications-related API calls. Handles game notification functionality. */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api-helpers";

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
};
