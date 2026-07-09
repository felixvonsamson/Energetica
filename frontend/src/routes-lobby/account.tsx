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
import { useMyRuns } from "@/hooks/use-lobby";

/**
 * The change-password form posts _natively_ to this lobby-backend route rather
 * than through the SPA's fetch client. That native submit navigation is what
 * makes Safari / Apple Passwords offer to update the saved credential — an
 * intercepted `fetch` (`preventDefault`) gives WebKit nothing to detect (issue
 * #849). The backend answers every outcome with a 303 back to `/account?pw=…`,
 * which we render as a banner.
 *
 * Absolute `/api` path: Apache proxies `/api` on the lobby vhost to the lobby
 * uvicorn.
 */
const CHANGE_PASSWORD_ACTION = "/api/v1/auth/change-password-form";

const MIN_PASSWORD_LENGTH = 7;

/** Post-redirect status the backend sets via `?pw=`. */
type PwStatus = "changed" | "old-incorrect" | "too-short";

function validateAccountSearch(search: Record<string, unknown>): {
    pw?: PwStatus;
} {
    const { pw } = search;
    return {
        pw:
            pw === "changed" || pw === "old-incorrect" || pw === "too-short"
                ? pw
                : undefined,
    };
}

export const Route = createFileRoute("/account")({
    validateSearch: validateAccountSearch,
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

    // `myRuns == null` collapses both the pending and logged-out cases, and
    // narrows the type so the form can read `myRuns.username` below.
    if (isPending || myRuns == null) {
        return (
            <div className="flex justify-center py-24">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center px-4 py-12">
            <ChangePasswordForm username={myRuns.username} />
        </div>
    );
}

function ChangePasswordForm({ username }: { username: string }) {
    const navigate = useNavigate();
    const { pw } = Route.useSearch();

    // Capture the post-redirect status once, then strip `?pw` so a manual refresh
    // doesn't replay the banner. `replace` is a client-side history swap — it cannot
    // affect the password-manager prompt, which already fired on the POST→GET nav.
    const [status] = useState<PwStatus | undefined>(pw);
    useEffect(() => {
        if (pw !== undefined) {
            void navigate({ to: "/account", search: {}, replace: true });
        }
    }, [pw, navigate]);

    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [clientError, setClientError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const success = status === "changed";
    const oldPasswordError =
        status === "old-incorrect"
            ? "The current password you entered is incorrect."
            : null;
    const generalError =
        clientError ??
        (status === "too-short"
            ? `New password must be at least ${MIN_PASSWORD_LENGTH} characters`
            : null);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        // Client-side gate for the checks the server can't infer from a single submit.
        // On failure we preventDefault + show an inline error; on success we do NOT
        // preventDefault, so the browser performs the native submit the password manager
        // needs to see. (Empty fields and min-length are enforced by native `required` /
        // `minLength`, which block the submit before this handler even fires.)
        setClientError(null);

        if (newPassword !== confirmPassword) {
            e.preventDefault();
            setClientError("New passwords do not match");
            return;
        }
        if (newPassword === oldPassword) {
            e.preventDefault();
            setClientError(
                "New password must differ from your current password",
            );
            return;
        }

        // Disable the button for the brief moment before the navigation lands. Only the
        // button, never the inputs: a disabled input is omitted from the native form
        // submission, which would drop the very fields we're posting.
        setSubmitting(true);
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
                            Your password has been changed successfully.
                        </InfoBanner>
                    )}

                    {generalError && (
                        <InfoBanner variant="error" className="mb-6">
                            {generalError}
                        </InfoBanner>
                    )}

                    <form
                        method="POST"
                        action={CHANGE_PASSWORD_ACTION}
                        onSubmit={handleSubmit}
                        className="space-y-6"
                    >
                        {/* Read-only username so password managers (Apple
                            Passwords especially) know *which* saved credential
                            this current-password → new-password change updates.
                            Without an autocomplete="username" field they won't
                            offer to update the stored password. */}
                        <div>
                            <Label htmlFor="username" className="mb-2">
                                Account
                            </Label>
                            <Input
                                type="text"
                                id="username"
                                name="username"
                                value={username}
                                autoComplete="username"
                                readOnly
                                tabIndex={-1}
                                className="text-muted-foreground"
                            />
                        </div>

                        <div>
                            <Label htmlFor="oldPassword" className="mb-2">
                                Current password
                            </Label>
                            <Input
                                type="password"
                                id="oldPassword"
                                name="old_password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                placeholder="Enter current password"
                                required
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
                                New password (minimum {MIN_PASSWORD_LENGTH}{" "}
                                characters)
                            </Label>
                            <Input
                                type="password"
                                id="newPassword"
                                name="new_password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Choose a new password"
                                required
                                minLength={MIN_PASSWORD_LENGTH}
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
                                name="confirm_password"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                placeholder="Confirm your new password"
                                required
                                autoComplete="new-password"
                            />
                        </div>

                        <Button
                            type="submit"
                            variant={submitting ? "outline" : "default"}
                            size="lg"
                            disabled={submitting}
                            className="w-full flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <Spinner />
                            ) : (
                                <KeyRound className="w-5 h-5" />
                            )}
                            Change password
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
