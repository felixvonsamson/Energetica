/// <reference lib="webworker" />

import type { NotificationPayload, NotificationType } from "@/types/notifications";
import { getNotificationPushText, getNotificationUrl } from "@/lib/notification-config";

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
    const { title, body } = getNotificationPushText(payload);
    const url = getNotificationUrl(data.type);
    event.waitUntil(
        sw.registration.showNotification(title, {
            body,
            icon: "/static/images/icon_green.png",
            data: { url },
        })
    );
});

sw.addEventListener("notificationclick", (event: NotificationEvent) => {
    event.notification.close();
    const path: string = (event.notification.data as { url?: string } | null)?.url ?? "/app/overview";
    event.waitUntil(sw.clients.openWindow(sw.location.origin + path));
});
