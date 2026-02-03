import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

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

                        <Switch
                            id="notifications-switch"
                            checked={notificationsEnabled}
                            onCheckedChange={handleNotificationsToggle}
                            disabled={notificationsLoading}
                        />
                    </CardContent>
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
