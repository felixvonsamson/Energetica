import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { GameLayout } from "@/components/layout/game-layout";
import { Card, Button, InfoBanner, CardContent } from "@/components/ui";
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
import { useChangePassword } from "@/hooks/useAuthQueries";
import { handleApiError } from "@/lib/error-utils";

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
            isUnlocked: () => true,
        },
        infoModal: {
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
    const [showChangePasswordModal, setShowChangePasswordModal] =
        useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [notificationsLoading, setNotificationsLoading] = useState(false);

    // Handle browser notifications toggle
    const handleNotificationsToggle = async () => {
        setNotificationsLoading(true);
        try {
            if ("serviceWorker" in navigator && "Notification" in window) {
                if (!notificationsEnabled) {
                    // Request permission and subscribe
                    const permission = await Notification.requestPermission();
                    if (permission === "granted") {
                        setNotificationsEnabled(true);
                        // TODO: Subscribe to push notifications
                        // const registration = await navigator.serviceWorker.ready;
                        // const subscription = await registration.pushManager.subscribe(...);
                        // Send subscription to backend
                    }
                } else {
                    // Unsubscribe
                    setNotificationsEnabled(false);
                    // TODO: Unsubscribe from push notifications
                    // const registration = await navigator.serviceWorker.ready;
                    // const subscription = await registration.pushManager.getSubscription();
                    // if (subscription) subscription.unsubscribe();
                }
            }
        } catch (error) {
            console.error("Failed to toggle notifications:", error);
        } finally {
            setNotificationsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8">
            {/* Title */}
            <div className="flex items-center justify-center mb-8">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Settings
                </h1>
            </div>

            {/* Settings cards */}
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Browser Notifications Card */}
                <Card className="border-2 border-border">
                    <CardContent className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold mb-2">
                                Browser Notifications
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Receive notifications about important game
                                events
                            </p>
                        </div>
                        <Label className="relative inline-flex items-center cursor-pointer">
                            <Input
                                type="checkbox"
                                checked={notificationsEnabled}
                                onChange={handleNotificationsToggle}
                                disabled={notificationsLoading}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-green rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green dark:peer-checked:bg-brand-green"></div>
                        </Label>
                    </CardContent>
                </Card>

                {/* Password Settings Card */}
                <Card className="border-2 border-border">
                    <CardContent>
                        <h2 className="text-lg font-semibold mb-4">
                            Password Settings
                        </h2>
                        <Button
                            onClick={() => setShowChangePasswordModal(true)}
                            variant="default"
                        >
                            Change Password
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Change Password Modal */}
            <ChangePasswordModal
                isOpen={showChangePasswordModal}
                onClose={() => setShowChangePasswordModal(false)}
            />
        </div>
    );
}

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
    const { mutate: changePassword, isPending } = useChangePassword();
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const resetForm = () => {
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setError(null);
        setSuccessMessage(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        // Validation
        if (!oldPassword.trim()) {
            setError("Please enter your old password");
            return;
        }

        if (!newPassword.trim()) {
            setError("Please enter a new password");
            return;
        }

        if (!confirmPassword.trim()) {
            setError("Please confirm your new password");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (newPassword === oldPassword) {
            setError("New password must be different from old password");
            return;
        }

        // Submit
        changePassword(
            {
                old_password: oldPassword,
                new_password: newPassword,
            },
            {
                onSuccess: () => {
                    setSuccessMessage("Password changed successfully");
                    setTimeout(() => {
                        resetForm();
                        onClose();
                    }, 1500);
                },
                onError: (err) => {
                    const errorMessage = handleApiError(
                        err,
                        "Failed to change password",
                    );
                    setError(errorMessage);
                },
            },
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <form onSubmit={handleSubmit} id="change-password-form">
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>
                            Enter your old password and choose a new one.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {error && (
                            <InfoBanner variant="error">{error}</InfoBanner>
                        )}

                        {successMessage && (
                            <InfoBanner variant="info">
                                {successMessage}
                            </InfoBanner>
                        )}

                        <div className="grid gap-3">
                            <Label htmlFor="old_password">Old Password</Label>
                            <Input
                                type="password"
                                id="old_password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                placeholder="Enter old password"
                                disabled={isPending}
                            />
                        </div>

                        <div className="grid gap-3">
                            <Label htmlFor="new_password">New Password</Label>
                            <Input
                                type="password"
                                id="new_password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                                disabled={isPending}
                            />
                        </div>

                        <div className="grid gap-3">
                            <Label htmlFor="confirm_password">
                                Confirm New Password
                            </Label>
                            <Input
                                type="password"
                                id="confirm_password"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                placeholder="Confirm new password"
                                disabled={isPending}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" disabled={isPending}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            form="change-password-form"
                            variant={isPending ? "outline" : "default"}
                            disabled={isPending}
                            className="flex items-center gap-2"
                        >
                            {isPending && <Spinner />}
                            Change Password
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </form>
        </Dialog>
    );
}
