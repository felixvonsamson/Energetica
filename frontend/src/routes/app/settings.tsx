import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { GameLayout } from "@/components/layout/game-layout";
import { Card, InfoBanner, CardContent, ThemeToggle } from "@/components/ui";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
    TypographyH2,
    TypographyLarge,
    TypographyMuted,
} from "@/components/ui/typography";
import { browserNotificationsApi } from "@/lib/api/push-subscriptions";
import {
    getAllPushPrefs,
    setPushPref,
    PUSH_CATEGORIES,
} from "@/lib/push-notification-prefs";
import { PUSH_CATEGORY_LABELS, type PushCategory } from "@/types/notifications";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
}

function SettingsHelp() {
    return (
        <div className="space-y-3">
            <p>On this page you can change the settings of your account.</p>
        </div>
    );
}

export const Route = createFileRoute("/app/settings")({
    component: SettingsPage,
    staticData: {
        title: "Settings",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => ({ unlocked: true }),
        },
        infoDialog: {
            contents: <SettingsHelp />,
        },
    },
});

function SettingsPage() {
    return (
        <GameLayout>
            <SettingsContent />
        </GameLayout>
    );
}

function SettingsContent() {
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notificationsPermissionDenied, setNotificationsPermissionDenied] =
        useState(false);
    const [notificationsError, setNotificationsError] = useState<string | null>(
        null,
    );
    const [pushPrefs, setPushPrefs] = useState<Record<
        PushCategory,
        boolean
    > | null>(null);

    // Initialize toggle state from reality on mount
    useEffect(() => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window))
            return;
        navigator.serviceWorker.ready
            .then((reg) => reg.pushManager.getSubscription())
            .then((sub) => {
                setNotificationsEnabled(!!sub);
            });
        getAllPushPrefs().then(setPushPrefs);
    }, []);

    // Handle browser notifications toggle
    const handleNotificationsToggle = async () => {
        setNotificationsLoading(true);
        setNotificationsError(null);
        try {
            if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
                const isIOS =
                    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                    (navigator.platform === "MacIntel" &&
                        navigator.maxTouchPoints > 1);
                throw new Error(
                    isIOS
                        ? "On iOS, add this site to your Home Screen first (Share → Add to Home Screen), then enable notifications from there."
                        : "Browser notifications are not supported in this browser.",
                );
            }

            if (!notificationsEnabled) {
                // Enable: request permission, subscribe
                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                    setNotificationsPermissionDenied(true);
                    return;
                }
                setNotificationsPermissionDenied(false);

                await navigator.serviceWorker.register("/service-worker.js");
                const registration = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise<never>((_, reject) =>
                        setTimeout(
                            () =>
                                reject(
                                    new Error(
                                        "Service worker took too long to activate. Try reloading the page.",
                                    ),
                                ),
                            10_000,
                        ),
                    ),
                ]);

                const { public_key: vapidKey } =
                    await browserNotificationsApi.getVapidKey();

                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidKey),
                });

                const rawKey = subscription.getKey("p256dh");
                const rawAuth = subscription.getKey("auth");

                if (!rawKey || !rawAuth) {
                    throw new Error(
                        "Failed to retrieve push subscription keys.",
                    );
                }

                const p256dh = btoa(
                    String.fromCharCode(...new Uint8Array(rawKey)),
                );
                const auth = btoa(
                    String.fromCharCode(...new Uint8Array(rawAuth)),
                );

                await browserNotificationsApi.subscribe({
                    endpoint: subscription.endpoint,
                    keys: { p256dh, auth },
                });

                await browserNotificationsApi.test(subscription.endpoint);

                setNotificationsEnabled(true);
            } else {
                // Disable: unsubscribe
                const registration = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise<never>((_, reject) =>
                        setTimeout(
                            () =>
                                reject(
                                    new Error(
                                        "Service worker took too long to activate. Try reloading the page.",
                                    ),
                                ),
                            10_000,
                        ),
                    ),
                ]);
                const subscription =
                    await registration.pushManager.getSubscription();

                if (subscription) {
                    const rawKey = subscription.getKey("p256dh");
                    const rawAuth = subscription.getKey("auth");

                    if (rawKey && rawAuth) {
                        const p256dh = btoa(
                            String.fromCharCode(...new Uint8Array(rawKey)),
                        );
                        const auth = btoa(
                            String.fromCharCode(...new Uint8Array(rawAuth)),
                        );

                        await browserNotificationsApi.unsubscribe({
                            endpoint: subscription.endpoint,
                            keys: { p256dh, auth },
                        });
                    }

                    await subscription.unsubscribe();
                }

                setNotificationsEnabled(false);
            }
        } catch (error) {
            console.error("Failed to toggle notifications:", error);
            setNotificationsError(
                error instanceof Error
                    ? error.message
                    : "Something went wrong. Please try again.",
            );
        } finally {
            setNotificationsLoading(false);
        }
    };

    const handleCategoryToggle = async (
        category: PushCategory,
        enabled: boolean,
    ) => {
        await setPushPref(category, enabled);
        setPushPrefs((prev) =>
            prev ? { ...prev, [category]: enabled } : prev,
        );
    };

    return (
        <div className="p-4 md:p-8">
            {/* Settings cards */}
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Browser Notifications Card */}
                <Card>
                    <CardContent className="flex items-center justify-between">
                        <div>
                            <TypographyH2>
                                <TypographyLarge>
                                    Browser Notifications
                                </TypographyLarge>
                            </TypographyH2>
                            <TypographyMuted>
                                Receive notifications about important game
                                events
                            </TypographyMuted>
                        </div>

                        <div className="flex items-center gap-2">
                            {notificationsLoading && <Spinner />}
                            <Switch
                                id="notifications-switch"
                                checked={notificationsEnabled}
                                onCheckedChange={handleNotificationsToggle}
                                disabled={notificationsLoading}
                            />
                        </div>
                    </CardContent>
                    {notificationsPermissionDenied && (
                        <CardContent>
                            <InfoBanner variant="error">
                                Browser notifications were blocked. Please
                                enable them in your browser settings and try
                                again.
                            </InfoBanner>
                        </CardContent>
                    )}
                    {notificationsError && (
                        <CardContent>
                            <InfoBanner variant="error">
                                {notificationsError}
                            </InfoBanner>
                        </CardContent>
                    )}
                    {notificationsEnabled && pushPrefs && (
                        <CardContent className="flex flex-col gap-3 border-t pt-4">
                            {PUSH_CATEGORIES.map((category) => (
                                <div
                                    key={category}
                                    className="flex items-center justify-between"
                                >
                                    <Label htmlFor={`push-pref-${category}`}>
                                        {PUSH_CATEGORY_LABELS[category]}
                                    </Label>
                                    <Switch
                                        id={`push-pref-${category}`}
                                        checked={pushPrefs[category]}
                                        onCheckedChange={(checked) =>
                                            handleCategoryToggle(
                                                category,
                                                checked,
                                            )
                                        }
                                    />
                                </div>
                            ))}
                        </CardContent>
                    )}
                </Card>

                <Card>
                    <CardContent className="flex items-center justify-between">
                        <div>
                            <TypographyH2>
                                <TypographyLarge>Theme</TypographyLarge>
                            </TypographyH2>
                            <TypographyMuted>
                                Choose between light and dark theme
                            </TypographyMuted>
                        </div>
                        <ThemeToggle />
                    </CardContent>
                </Card>

                {/* Password changes live at the lobby, which owns credentials for the whole
                    server (ADR-0002/0003); the instance no longer has a password endpoint. */}
            </div>
        </div>
    );
}
