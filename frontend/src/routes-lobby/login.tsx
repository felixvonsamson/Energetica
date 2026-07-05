import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoBanner } from "@/components/ui/info-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { TypographyBrand } from "@/components/ui/typography";
import { useLobbyLogin, useMyRuns } from "@/hooks/use-lobby";
import { getUserFriendlyError, isErrorType } from "@/lib/error-utils";
import { lobbyLandingHref, validateReturnSearch } from "@/lib/lobby";

export const Route = createFileRoute("/login")({
    validateSearch: validateReturnSearch,
    component: LoginPage,
    staticData: { title: "Log in" },
});

function LoginPage() {
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
            <LoginForm returnSlug={returnSlug} />
        </div>
    );
}

function LoginForm({ returnSlug }: { returnSlug: string | undefined }) {
    const navigate = useNavigate();
    const login = useLobbyLogin();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [generalError, setGeneralError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUsernameError(null);
        setPasswordError(null);
        setGeneralError(null);

        if (!username.trim() || !password) {
            setGeneralError("Please enter both username and password.");
            return;
        }

        try {
            await login.mutateAsync({ username: username.trim(), password });
            // The picker resolves a valid ?return= slug into its run.
            await navigate({ to: "/", search: { return: returnSlug } });
        } catch (err) {
            if (isErrorType(err, "USER_NOT_FOUND")) {
                setUsernameError(getUserFriendlyError(err));
            } else if (isErrorType(err, "INVALID_PASSWORD")) {
                setPasswordError(getUserFriendlyError(err));
            } else {
                setGeneralError(getUserFriendlyError(err));
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

            {/* Login Card */}
            <Card className="shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl">Log in</CardTitle>
                </CardHeader>

                <CardContent>
                    {generalError && (
                        <InfoBanner variant="error" className="mb-6">
                            {generalError}
                        </InfoBanner>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <Label htmlFor="username" className="mb-2">
                                Username
                            </Label>
                            <Input
                                type="text"
                                id="username"
                                name="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                disabled={login.isPending}
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
                                Password
                            </Label>
                            <Input
                                type="password"
                                id="password"
                                name="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                disabled={login.isPending}
                                autoComplete="current-password"
                                aria-invalid={passwordError ? true : undefined}
                            />
                            {passwordError && (
                                <p className="mt-1 text-sm text-destructive">
                                    {passwordError}
                                </p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            variant={login.isPending ? "outline" : "default"}
                            size="lg"
                            disabled={login.isPending}
                            className="w-full flex items-center justify-center gap-2"
                        >
                            {login.isPending ? (
                                <Spinner />
                            ) : (
                                <LogIn className="w-5 h-5" />
                            )}
                            <>Log in</>
                        </Button>
                    </form>

                    {/* Sign Up Link */}
                    <div className="mt-6">
                        <div className="text-center text-sm text-primary mb-3">
                            - OR -
                        </div>
                        <Link to="/signup" search={{ return: returnSlug }}>
                            <Button
                                variant="secondary"
                                size="lg"
                                className="w-full"
                            >
                                Create account
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
