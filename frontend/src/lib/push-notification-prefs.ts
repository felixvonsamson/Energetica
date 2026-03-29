/**
 * Browser push notification preferences — per notification category, per
 * device.
 *
 * Stored in IndexedDB so the service worker can read them before deciding
 * whether to show a notification. (localStorage is not accessible from service
 * workers.)
 *
 * Defaults to enabled for all categories.
 */

import type { NotificationCategory } from "@/types/notifications";

export const PUSH_NOTIF_CATEGORY_LABELS: Record<NotificationCategory, string> =
    {
        messages: "Messages",
        projects: "Projects",
        market: "Market",
        events: "Events",
        achievements: "Achievements",
    };

export const PUSH_NOTIF_CATEGORIES = Object.keys(
    PUSH_NOTIF_CATEGORY_LABELS,
) as NotificationCategory[];

const DB_NAME = "energetica";
const DB_VERSION = 1;
const STORE_NAME = "push-prefs";

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
        req.onerror = () => reject(req.error);
    });
}

export async function getPushPref(
    category: NotificationCategory,
): Promise<boolean> {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(category);
        req.onsuccess = () =>
            resolve((req.result as boolean | undefined) ?? true);
        req.onerror = () => resolve(true); // fail open
    });
}

export async function setPushPref(
    category: NotificationCategory,
    enabled: boolean,
): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(enabled, category);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getAllPushPrefs(): Promise<
    Record<NotificationCategory, boolean>
> {
    const entries = await Promise.all(
        PUSH_NOTIF_CATEGORIES.map(
            async (cat) => [cat, await getPushPref(cat)] as const,
        ),
    );
    return Object.fromEntries(entries) as Record<NotificationCategory, boolean>;
}
