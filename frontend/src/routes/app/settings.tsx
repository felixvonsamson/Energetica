import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { GameLayout } from "@/components/layout/game-layout";
import {
    Card,
    Button,
    InfoBanner,
    CardContent,
    ThemeToggle,
} from "@/components/ui";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
    TypographyH2,
    TypographyLarge,
    TypographyMuted,
} from "@/components/ui/typography";
import { useChangePassword } from "@/hooks/use-auth-queries";
import { browserNotificationsApi } from "@/lib/api/push-subscriptions";
import { handleApiError } from "@/lib/error-utils";
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
    const [showChangePasswordDialog, setShowChangePasswordDialog] =
        useState(false);
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

                {/* Password Settings Card */}
                <Card>
                    <CardContent className="flex items-center justify-between">
                        <TypographyH2>
                            <TypographyLarge>Password Settings</TypographyLarge>
                        </TypographyH2>
                        <Button
                            onClick={() => setShowChangePasswordDialog(true)}
                            variant="default"
                        >
                            Change Password
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Change Password Dialog */}
            <ChangePasswordDialog
                isOpen={showChangePasswordDialog}
                onClose={() => setShowChangePasswordDialog(false)}
            />
        </div>
    );
}

interface ChangePasswordDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

function ChangePasswordDialog({ isOpen, onClose }: ChangePasswordDialogProps) {
    const changePassword = useChangePassword();
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [fieldErrors, setFieldErrors] = useState<{
        oldPassword?: string;
        newPassword?: string;
        confirmPassword?: string;
    }>({});

    const resetForm = () => {
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setFieldErrors({});
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errors: typeof fieldErrors = {};

        if (!oldPassword) {
            errors.oldPassword = "Current password is required";
        }

        if (!newPassword) {
            errors.newPassword = "New password is required";
        } else if (newPassword.length < 8) {
            errors.newPassword = "Password must be at least 8 characters";
        } else if (oldPassword && newPassword === oldPassword) {
            errors.newPassword =
                "New password must differ from current password";
        }

        if (!confirmPassword) {
            errors.confirmPassword = "Please confirm your new password";
        } else if (newPassword && confirmPassword !== newPassword) {
            errors.confirmPassword = "Passwords do not match";
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        changePassword.mutate(
            {
                old_password: oldPassword,
                new_password: newPassword,
            },
            {
                onSuccess: () => {
                    toast.success("Password changed successfully");
                    resetForm();
                    onClose();
                },
                onError: (err) => {
                    const errorMessage = handleApiError(
                        err,
                        "Failed to change password",
                    );
                    toast.error(errorMessage);
                },
            },
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent>
                <form onSubmit={handleSubmit} id="change-password-form">
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>
                            Enter your current password and choose a new one.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="old_password">
                                Current Password
                            </Label>
                            <Input
                                type="password"
                                id="old_password"
                                value={oldPassword}
                                onChange={(e) => {
                                    setOldPassword(e.target.value);
                                    setFieldErrors((prev) => ({
                                        ...prev,
                                        oldPassword: undefined,
                                    }));
                                }}
                                placeholder="Enter current password"
                                disabled={changePassword.isPending}
                                aria-invalid={!!fieldErrors.oldPassword}
                            />
                            {fieldErrors.oldPassword && (
                                <p className="text-destructive text-sm">
                                    {fieldErrors.oldPassword}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="new_password">New Password</Label>
                            <Input
                                type="password"
                                id="new_password"
                                value={newPassword}
                                onChange={(e) => {
                                    setNewPassword(e.target.value);
                                    setFieldErrors((prev) => ({
                                        ...prev,
                                        newPassword: undefined,
                                    }));
                                }}
                                placeholder="Enter new password"
                                disabled={changePassword.isPending}
                                aria-invalid={!!fieldErrors.newPassword}
                            />
                            {fieldErrors.newPassword && (
                                <p className="text-destructive text-sm">
                                    {fieldErrors.newPassword}
                                </p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="confirm_password">
                                Confirm New Password
                            </Label>
                            <Input
                                type="password"
                                id="confirm_password"
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    setFieldErrors((prev) => ({
                                        ...prev,
                                        confirmPassword: undefined,
                                    }));
                                }}
                                placeholder="Re-enter new password"
                                disabled={changePassword.isPending}
                                aria-invalid={!!fieldErrors.confirmPassword}
                            />
                            {fieldErrors.confirmPassword && (
                                <p className="text-destructive text-sm">
                                    {fieldErrors.confirmPassword}
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                disabled={changePassword.isPending}
                            >
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            form="change-password-form"
                            variant={
                                changePassword.isPending ? "outline" : "default"
                            }
                            disabled={changePassword.isPending}
                            className="flex items-center gap-2"
                        >
                            {changePassword.isPending && <Spinner />}
                            Change Password
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
