import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoBanner } from "@/components/ui/info-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { TypographyBrand } from "@/components/ui/typography";
import { useLobbySignup, useMyRuns } from "@/hooks/use-lobby";
import { getUserFriendlyError, isErrorType } from "@/lib/error-utils";
import { lobbyLandingHref, validateReturnSearch } from "@/lib/lobby";

export const Route = createFileRoute("/signup")({
    validateSearch: validateReturnSearch,
    component: SignUpPage,
    staticData: { title: "Create account" },
});

function SignUpPage() {
    const navigate = useNavigate();
    const { return: returnSlug } = Route.useSearch();
    const { data: myRuns } = useMyRuns();
    const isAuthenticated = myRuns != null;

    // Already logged in → the picker (which also resolves a ?return= bounce).
    useEffect(() => {
        if (isAuthenticated) {
            void navigate({ to: "/", search: { return: returnSlug } });
        }
    }, [isAuthenticated, navigate, returnSlug]);

    if (isAuthenticated) {
        return null;
    }

    return (
        <div className="flex items-center justify-center px-4 py-12">
            <SignUpForm returnSlug={returnSlug} />
        </div>
    );
}

function SignUpForm({ returnSlug }: { returnSlug: string | undefined }) {
    const navigate = useNavigate();
    const signup = useLobbySignup();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [usernameError, setUsernameError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setUsernameError(null);

        // Validation (mirrors the backend SignupRequest constraints)
        if (!username.trim() || !password || !confirmPassword) {
            setError("Please fill in all fields");
            return;
        }

        if (username.trim().length < 3 || username.trim().length > 18) {
            setError("Username must be between 3 and 18 characters");
            return;
        }

        if (password.length < 7) {
            setError("Password must be at least 7 characters");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        try {
            await signup.mutateAsync({ username: username.trim(), password });
            // Account-only signup (ADR-0003): no run joined yet — the picker
            // shows open runs, and resolves a valid ?return= slug into its run.
            await navigate({ to: "/", search: { return: returnSlug } });
        } catch (err) {
            if (isErrorType(err, "USERNAME_TAKEN")) {
                setUsernameError(getUserFriendlyError(err));
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
                <a
                    href={lobbyLandingHref("/landing-page")}
                    className="text-base text-primary hover:opacity-80 transition-opacity underline"
                >
                    Learn more about Energetica
                </a>
            </div>

            {/* Sign Up Card */}
            <Card className="shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl">Create account</CardTitle>
                </CardHeader>

                <CardContent>
                    {error && (
                        <InfoBanner variant="error" className="mb-6">
                            {error}
                        </InfoBanner>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <Label htmlFor="username" className="mb-2">
                                Username (3-18 characters)
                            </Label>
                            <Input
                                type="text"
                                id="username"
                                name="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Choose a username"
                                disabled={signup.isPending}
                                minLength={3}
                                maxLength={18}
                                autoComplete="username"
                                aria-invalid={usernameError ? true : undefined}
                                // eslint-disable-next-line jsx-a11y/no-autofocus
                                autoFocus
                            />
                            {usernameError && (
                                <p className="mt-1 text-sm text-destructive">
                                    {usernameError}
                                </p>
                            )}
                        </div>

                        <div>
                            <Label htmlFor="password" className="mb-2">
                                Password (minimum 7 characters)
                            </Label>
                            <Input
                                type="password"
                                id="password"
                                name="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Choose a password"
                                disabled={signup.isPending}
                                minLength={7}
                                autoComplete="new-password"
                            />
                        </div>

                        <div>
                            <Label htmlFor="confirmPassword" className="mb-2">
                                Confirm Password
                            </Label>
                            <Input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                placeholder="Confirm your password"
                                disabled={signup.isPending}
                                minLength={7}
                                autoComplete="new-password"
                            />
                        </div>

                        <Button
                            type="submit"
                            variant={signup.isPending ? "outline" : "default"}
                            size="lg"
                            disabled={signup.isPending}
                            className="w-full flex items-center justify-center gap-2"
                        >
                            {signup.isPending ? (
                                <Spinner />
                            ) : (
                                <UserPlus className="w-5 h-5" />
                            )}
                            Create account
                        </Button>
                    </form>

                    {/* Login Link */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-primary">
                            Already have an account?{" "}
                            <Link
                                to="/login"
                                search={{ return: returnSlug }}
                                className="text-brand-green hover:opacity-80 transition-opacity font-medium underline"
                            >
                                Log in here
                            </Link>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
