/// <reference lib="webworker" />

import type { NotificationType } from "@/types/notifications";

// Cast the global scope to ServiceWorkerGlobalScope since this file is a service worker.
const sw = self as unknown as ServiceWorkerGlobalScope;

interface PushData {
    type: NotificationType;
    payload: Record<string, unknown>;
}

function getNotificationText(data: PushData): { title: string; body: string } {
    const p = data.payload;
    switch (data.type) {
        case "construction_finished":
            return { title: "Construction finished", body: `${p.project_name} is now operational.` };
        case "technology_researched":
            return { title: "Research complete", body: `${p.technology_name} level ${p.new_level} unlocked.` };
        case "facility_decommissioned":
            return { title: "Facility decommissioned", body: `${p.facility_name} was decommissioned.` };
        case "facility_destroyed":
            return { title: "Facility destroyed", body: `${p.facility_name} was destroyed by ${p.event_name}.` };
        case "emergency_facility_created":
            return { title: "Emergency facility", body: `A ${p.facility_name} was created automatically.` };
        case "climate_event":
            return { title: "Climate event", body: `${p.event_name} is affecting your facilities.` };
        case "resource_sold":
            return { title: "Resource sold", body: `${p.buyer_username} purchased your ${p.resource}.` };
        case "shipment_arrived":
            return { title: "Shipment arrived", body: `Your ${p.resource} shipment has arrived.` };
        case "credit_limit_exceeded":
            return { title: "Credit limit exceeded", body: "Not enough money for market participation." };
        case "achievement_unlocked":
            return { title: "Achievement unlocked", body: `You unlocked: ${p.achievement_name}` };
        default:
            return { title: "New notification", body: "" };
    }
}

function getNotificationUrl(type: NotificationType, _payload: Record<string, unknown>): string {
    switch (type) {
        case "construction_finished":
        case "facility_decommissioned":
        case "facility_destroyed":
        case "emergency_facility_created":
            return "/app/constructions";
        case "technology_researched":
            return "/app/research";
        case "climate_event":
            return "/app/overview";
        case "resource_sold":
        case "shipment_arrived":
        case "credit_limit_exceeded":
            return "/app/resource-market";
        case "achievement_unlocked":
            return "/app/achievements";
        default:
            return "/app/overview";
    }
}

sw.addEventListener("push", (event: PushEvent) => {
    if (!event.data) return;
    const data: PushData = event.data.json() as PushData;
    const { title, body } = getNotificationText(data);
    const url = getNotificationUrl(data.type, data.payload);
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
    const url: string = (event.notification.data as { url?: string } | null)?.url ?? "https://energetica.ethz.ch";
    event.waitUntil(sw.clients.openWindow(url));
});
