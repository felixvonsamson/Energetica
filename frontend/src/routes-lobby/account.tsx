import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoBanner } from "@/components/ui/info-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { TypographyBrand } from "@/components/ui/typography";
import { useLobbyChangePassword, useMyRuns } from "@/hooks/use-lobby";
import { getUserFriendlyError, isErrorType } from "@/lib/error-utils";

export const Route = createFileRoute("/account")({
    component: AccountPage,
    staticData: { title: "Account" },
});

function AccountPage() {
    const navigate = useNavigate();
    const { data: myRuns, isPending } = useMyRuns();
    const isLoggedOut = !isPending && myRuns == null;

    // Account settings are auth-only — bounce a logged-out visitor to login.
    useEffect(() => {
        if (isLoggedOut) {
            void navigate({ to: "/login" });
        }
    }, [isLoggedOut, navigate]);

    if (isPending || isLoggedOut) {
        return (
            <div className="flex justify-center py-24">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center px-4 py-12">
            <ChangePasswordForm />
        </div>
    );
}

function ChangePasswordForm() {
    const changePassword = useLobbyChangePassword();

    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [oldPasswordError, setOldPasswordError] = useState<string | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setOldPasswordError(null);
        setError(null);
        setSuccess(false);

        if (!oldPassword || !newPassword || !confirmPassword) {
            setError("Please fill in all fields");
            return;
        }

        // Mirrors the backend ChangePasswordRequest constraint (new_password ≥ 7).
        if (newPassword.length < 7) {
            setError("New password must be at least 7 characters");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("New passwords do not match");
            return;
        }

        if (newPassword === oldPassword) {
            setError("New password must differ from your current password");
            return;
        }

        try {
            await changePassword.mutateAsync({
                old_password: oldPassword,
                new_password: newPassword,
            });
            setSuccess(true);
            setOldPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            if (isErrorType(err, "OLD_PASSWORD_INCORRECT")) {
                setOldPasswordError(getUserFriendlyError(err));
            } else {
                setError(getUserFriendlyError(err));
            }
        }
    };

    return (
        <div className="w-full max-w-md">
            {/* Branding */}
            <div className="text-center mb-8">
                <TypographyBrand className="text-5xl text-primary mb-4 block">
                    Energetica
                </TypographyBrand>
                <Link
                    to="/"
                    className="text-base text-primary hover:opacity-80 transition-opacity underline"
                >
                    Back to your runs
                </Link>
            </div>

            {/* Change Password Card */}
            <Card className="shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl">Change password</CardTitle>
                </CardHeader>

                <CardContent>
                    {success && (
                        <InfoBanner variant="success" className="mb-6">
                            Your password has been changed. It applies the next
                            time you log in.
                        </InfoBanner>
                    )}

                    {error && (
                        <InfoBanner variant="error" className="mb-6">
                            {error}
                        </InfoBanner>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <Label htmlFor="oldPassword" className="mb-2">
                                Current password
                            </Label>
                            <Input
                                type="password"
                                id="oldPassword"
                                name="oldPassword"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                placeholder="Enter current password"
                                disabled={changePassword.isPending}
                                autoComplete="current-password"
                                aria-invalid={
                                    oldPasswordError ? true : undefined
                                }
                                // eslint-disable-next-line jsx-a11y/no-autofocus
                                autoFocus
                            />
                            {oldPasswordError && (
                                <p className="mt-1 text-sm text-destructive">
                                    {oldPasswordError}
                                </p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="newPassword" className="mb-2">
                                New password (minimum 7 characters)
                            </Label>
                            <Input
                                type="password"
                                id="newPassword"
                                name="newPassword"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Choose a new password"
                                disabled={changePassword.isPending}
                                minLength={7}
                                autoComplete="new-password"
                            />
                        </div>

                        <div>
                            <Label htmlFor="confirmPassword" className="mb-2">
                                Confirm new password
                            </Label>
                            <Input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                placeholder="Confirm your new password"
                                disabled={changePassword.isPending}
                                minLength={7}
                                autoComplete="new-password"
                            />
                        </div>

                        <Button
                            type="submit"
                            variant={
                                changePassword.isPending ? "outline" : "default"
                            }
                            size="lg"
                            disabled={changePassword.isPending}
                            className="w-full flex items-center justify-center gap-2"
                        >
                            {changePassword.isPending ? (
                                <Spinner />
                            ) : (
                                <KeyRound className="w-5 h-5" />
                            )}
                            <>Change password</>
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
