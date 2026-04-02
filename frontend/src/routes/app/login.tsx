import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useState, useEffect } from "react";

import { HomeLayout } from "@/components/home-layout";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Button,
    InfoBanner,
} from "@/components/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { TypographyBrand } from "@/components/ui/typography";
import { useAuth } from "@/hooks/use-auth";
import { useLogin } from "@/hooks/use-auth-queries";
import { useGameEngine } from "@/hooks/use-game";
import { getUserFriendlyError, isErrorType } from "@/lib/error-utils";

export const Route = createFileRoute("/app/login")({
    component: LoginPage,
    staticData: {
        title: "Login",
    },
});

function LoginPage() {
    const navigate = useNavigate();
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated && !isAuthLoading) {
            navigate({ to: "/app/dashboard" });
        }
    }, [isAuthenticated, isAuthLoading, navigate]);

    // Don't render the form if already authenticated
    if (isAuthenticated) {
        return null;
    }

    return (
        <HomeLayout>
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-4 py-12">
                <LoginForm />
            </div>
        </HomeLayout>
    );
}

function LoginForm() {
    const navigate = useNavigate();
    const { refetch: refetchAuth } = useAuth();

    const login = useLogin();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [usernameNotFound, setUsernameNotFound] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [generalError, setGeneralError] = useState<string | null>(null);

    const { data: gameEngineData } = useGameEngine();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUsernameNotFound(false);
        setPasswordError(null);
        setGeneralError(null);

        if (!username.trim() || !password) {
            setGeneralError("Please enter both username and password.");
            return;
        }

        try {
            await login.mutateAsync({ username: username.trim(), password });
            await refetchAuth();
            navigate({ to: "/app/dashboard" });
        } catch (err) {
            if (isErrorType(err, "USER_NOT_FOUND")) {
                setUsernameNotFound(true);
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
                <Link
                    to="/landing-page"
                    className="text-base text-primary hover:opacity-80 transition-opacity underline"
                >
                    Learn more about Energetica
                </Link>
            </div>

            {/* Login Card */}
            <Card className="shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl">Login</CardTitle>
                </CardHeader>

                <CardContent>
                    {/* General error banner */}
                    {generalError && (
                        <InfoBanner variant="error" className="mb-6">
                            {generalError}
                        </InfoBanner>
                    )}

                    {/* Username not found — shown as banner because it includes game context */}
                    {usernameNotFound && (
                        <InfoBanner variant="error" className="mb-6">
                            Username does not exist.
                            <br />
                            This server has restarted on{" "}
                            <strong>
                                {gameEngineData?.start_date
                                    ? new Date(
                                          gameEngineData.start_date,
                                      ).toLocaleDateString()
                                    : "a previous date"}
                            </strong>
                            .
                            <br /> All previous user accounts were removed.
                        </InfoBanner>
                    )}

                    {/* Login Form */}
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
                                aria-invalid={usernameNotFound ? true : undefined}
                                // eslint-disable-next-line jsx-a11y/no-autofocus
                                autoFocus
                            />
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
                            <>Login</>
                        </Button>
                    </form>

                    {/* Sign Up Link */}
                    <div className="mt-6">
                        <div className="text-center text-sm text-primary mb-3">
                            - OR -
                        </div>
                        <Link to="/sign-up">
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
