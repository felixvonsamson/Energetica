/// <reference lib="webworker" />

// Run `bun run build:sw` after modifying this file

import type { AnyPushPayload } from "@/lib/notification-config";
import {
    getPushText,
    getPushPath,
    getPushCategory,
} from "@/lib/notification-config";
import { getPushPref } from "@/lib/push-notification-prefs";

// Cast the global scope to ServiceWorkerGlobalScope since this file is a service worker.
const sw = self as unknown as ServiceWorkerGlobalScope;

interface PushData {
    type: string;
    payload: Record<string, unknown>;
}

sw.addEventListener("push", (event: PushEvent) => {
    if (!event.data) return;
    const data: PushData = event.data.json() as PushData;
    const payload = { type: data.type, ...data.payload } as AnyPushPayload;
    const category = getPushCategory(data.type);

    const alwaysShow = data.type === "push_notification_test";

    event.waitUntil(
        getPushPref(category).then((enabled) => {
            if (!enabled && !alwaysShow) {
                console.log(
                    `[SW] Push suppressed (category "${category}" disabled):`,
                    data.type,
                );
                return;
            }
            const { title, body } = getPushText(payload);
            const path = getPushPath(payload);
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
