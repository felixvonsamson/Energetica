import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { useState } from "react";

import { GameLayout } from "@/components/layout/GameLayout";
import { Modal, Card, Button, InfoBanner } from "@/components/ui";
import { useChangePassword } from "@/hooks/useAuthQueries";
import { handleApiError } from "@/lib/error-utils";

export const Route = createFileRoute("/app/settings")({
    component: SettingsPage,
    staticData: {
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => true,
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
    const [showInfoPopup, setShowInfoPopup] = useState(false);
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
            {/* Title with info icon */}
            <div className="flex items-center justify-center gap-3 mb-8">
                <h1 className="text-4xl md:text-5xl font-bold text-center">
                    Settings
                </h1>
                <button
                    onClick={() => setShowInfoPopup(true)}
                    className="text-primary hover:opacity-80 transition-opacity"
                    aria-label="Show help"
                >
                    <HelpCircle className="w-8 h-8" />
                </button>
            </div>

            {/* Info modal */}
            <Modal
                isOpen={showInfoPopup}
                onClose={() => setShowInfoPopup(false)}
                title="Help : Settings"
            >
                <div className="space-y-3">
                    <p>
                        On this page you can change the settings of your
                        account.
                    </p>
                </div>
            </Modal>

            {/* Settings cards */}
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Browser Notifications Card */}
                <Card className="border-2 border-pine dark:border-dark-border">
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold mb-2">
                                    Browser Notifications
                                </h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Receive notifications about important game
                                    events
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={notificationsEnabled}
                                    onChange={handleNotificationsToggle}
                                    disabled={notificationsLoading}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-green rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green dark:peer-checked:bg-brand-green"></div>
                            </label>
                        </div>
                    </div>
                </Card>

                {/* Password Settings Card */}
                <Card className="border-2 border-pine dark:border-dark-border">
                    <div className="p-6">
                        <h2 className="text-lg font-semibold mb-4">
                            Password Settings
                        </h2>
                        <Button
                            onClick={() => setShowChangePasswordModal(true)}
                            variant="primary"
                        >
                            Change Password
                        </Button>
                    </div>
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
        <Modal isOpen={isOpen} onClose={handleClose} title="Change Password">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <InfoBanner variant="error">{error}</InfoBanner>}

                {successMessage && (
                    <InfoBanner variant="success">{successMessage}</InfoBanner>
                )}

                <div>
                    <label
                        htmlFor="old_password"
                        className="block text-sm font-medium mb-2 text-white"
                    >
                        Old Password
                    </label>
                    <input
                        type="password"
                        id="old_password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Enter old password"
                        className="w-full px-4 py-2 rounded-lg bg-white dark:bg-dark-bg-secondary text-black dark:text-dark-text-primary border-2 border-gray-300 dark:border-dark-border focus:border-brand-green dark:focus:border-brand-green focus:outline-none transition-colors"
                        disabled={isPending}
                    />
                </div>

                <div>
                    <label
                        htmlFor="new_password"
                        className="block text-sm font-medium mb-2 text-white"
                    >
                        New Password
                    </label>
                    <input
                        type="password"
                        id="new_password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full px-4 py-2 rounded-lg bg-white dark:bg-dark-bg-secondary text-black dark:text-dark-text-primary border-2 border-gray-300 dark:border-dark-border focus:border-brand-green dark:focus:border-brand-green focus:outline-none transition-colors"
                        disabled={isPending}
                    />
                </div>

                <div>
                    <label
                        htmlFor="confirm_password"
                        className="block text-sm font-medium mb-2 text-white"
                    >
                        Confirm New Password
                    </label>
                    <input
                        type="password"
                        id="confirm_password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full px-4 py-2 rounded-lg bg-white dark:bg-dark-bg-secondary text-black dark:text-dark-text-primary border-2 border-gray-300 dark:border-dark-border focus:border-brand-green dark:focus:border-brand-green focus:outline-none transition-colors"
                        disabled={isPending}
                    />
                </div>

                <div className="flex justify-center gap-4 pt-4">
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={isPending}
                    >
                        {isPending ? "Changing..." : "Change Password"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
