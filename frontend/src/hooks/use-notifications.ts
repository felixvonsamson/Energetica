/**
 * Hooks for fetching and managing notifications.
 *
 * This module provides hooks for:
 *
 * - Fetching the notification list
 * - Getting the unread notification count
 * - Deleting individual notifications
 * - Marking all notifications as read
 *
 * All types are imported from @/types/notifications to keep
 * notification-related definitions in one place and stay synchronized with the
 * OpenAPI schema.
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo } from "react";

import { notificationsApi } from "@/lib/api/notifications";
import { queryKeys, queryClient } from "@/lib/query-client";

/**
 * Get the list of all notifications for the current user.
 *
 * Returns all notifications (read and unread). The frontend can filter or
 * compute unread count using a memo.
 *
 * @example
 *     const { data: notifications, isLoading, error } = useNotifications();
 *     if (notifications) {
 *         const unreadCount = notifications.notifications.filter(
 *             (n) => !n.read,
 *         ).length;
 *     }
 *
 * @returns Query result with typed notification list data
 */
export function useNotifications() {
    return useQuery({
        queryKey: queryKeys.notifications.all,
        queryFn: notificationsApi.getNotifications,
        staleTime: 30 * 1000, // 30 seconds - notifications update periodically
        gcTime: 5 * 60 * 1000, // 5 minutes - keep for offline access
        refetchOnWindowFocus: true,
    });
}

/**
 * Delete a notification.
 *
 * Automatically refreshes the notification list after deletion.
 *
 * @example
 *     const { mutate: deleteNotification, isPending } =
 *         useDeleteNotification();
 *     const handleDelete = (id: number) => {
 *         deleteNotification(id);
 *     };
 *
 * @returns Mutation hook for deleting notifications
 */
export function useDeleteNotification() {
    return useMutation<void, Error, number>({
        mutationFn: (notificationId: number) =>
            notificationsApi.deleteNotification(notificationId),
        onSuccess: () => {
            // Invalidate the notification list to refresh
            queryClient.invalidateQueries({
                queryKey: queryKeys.notifications.all,
            });
        },
    });
}

/**
 * Mark all notifications as read.
 *
 * Automatically refreshes the notification list after marking as read.
 *
 * @example
 *     const { mutate: markAllRead, isPending } = useMarkAllNotificationsRead();
 *     markAllRead();
 *
 * @returns Mutation hook for marking all notifications as read
 */
export function useMarkAllNotificationsRead() {
    return useMutation<void, Error, void>({
        mutationFn: notificationsApi.markAllRead,
        onSuccess: () => {
            // Invalidate the notification list to refresh
            queryClient.invalidateQueries({
                queryKey: queryKeys.notifications.all,
            });
        },
    });
}

/**
 * Get the count of unread notifications.
 *
 * Efficiently computes the unread count from the notification list using
 * memoization to avoid unnecessary recalculations.
 *
 * @example
 *     const unreadCount = useUnreadNotificationsCount();
 *     if (unreadCount > 0) {
 *         // Show badge
 *     }
 *
 * @returns The number of unread notifications
 */
export function useUnreadNotificationsCount() {
    const { data } = useNotifications();

    return useMemo(() => {
        return data?.notifications.filter((n) => !n.read).length ?? 0;
    }, [data]);
}
