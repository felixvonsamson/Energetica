/// <reference lib="webworker" />

// Run `bun run build:sw` after modifying this file

import type {
    NotificationPayload,
    NotificationType,
} from "@/types/notifications";
import {
    getNotificationPushText,
    getNotificationPath,
    NOTIFICATION_TYPE_TO_CATEGORY,
} from "@/lib/notification-config";
import { getPushPref } from "@/lib/push-notification-prefs";

// Cast the global scope to ServiceWorkerGlobalScope since this file is a service worker.
const sw = self as unknown as ServiceWorkerGlobalScope;

interface PushData {
    type: NotificationType;
    payload: Record<string, unknown>;
}

sw.addEventListener("push", (event: PushEvent) => {
    if (!event.data) return;
    const data: PushData = event.data.json() as PushData;
    const payload = { type: data.type, ...data.payload } as NotificationPayload;
    const category = NOTIFICATION_TYPE_TO_CATEGORY[data.type] ?? "events";

    event.waitUntil(
        getPushPref(category).then((enabled) => {
            if (!enabled) {
                console.log(
                    `[SW] Push suppressed (category "${category}" disabled):`,
                    data.type,
                );
                return;
            }
            const { title, body } = getNotificationPushText(payload);
            const path = getNotificationPath(payload);
            console.log("[SW] Showing notification:", data.type, title);
            return sw.registration.showNotification(title, {
                body,
                icon: "/static/images/icon_green.png",
                data: { path },
            });
        }),
    );
});

sw.addEventListener("notificationclick", (event: NotificationEvent) => {
    event.notification.close();
    const path: string =
        (event.notification.data as { path?: string } | null)?.path ??
        "/app/overview";
    event.waitUntil(sw.clients.openWindow(sw.location.origin + path));
});
