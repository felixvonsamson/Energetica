import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { HomeLayout } from "@/components/HomeLayout";
import { Card, Button, InfoBanner } from "@/components/ui";
import { authApi } from "@/lib/api/auth";
import { handleApiError, isErrorType } from "@/lib/error-utils";
import { useAuth } from "@/hooks/useAuth";
import { LogIn } from "lucide-react";

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

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Basic validation
        if (!username.trim() || !password) {
            setError("Please enter both username and password");
            return;
        }

        setIsLoading(true);

        try {
            await authApi.login({
                username: username.trim(),
                password,
            });

            // Refetch auth state to update context
            await refetchAuth();

            // Redirect to dashboard
            navigate({ to: "/app/dashboard" });
        } catch (err) {
            // Special handling for "User not found" to show migration message
            if (isErrorType(err, "User not found")) {
                setError(
                    `Username does not exist.<br/>
                    On the <b>14.10.2025</b>, the server has been migrated to <b><a href="https://energetica.ethz.ch" class="underline hover:opacity-80">energetica.ethz.ch</a></b>.
                    Apologies for the inconvenience.`,
                );
            } else {
                // Use centralized error handling for all other errors
                const errorMessage = handleApiError(
                    err,
                    "Login failed. Please try again.",
                );
                setError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md">
            {/* Branding */}
            <div className="text-center mb-8">
                <h1 className="text-5xl font-bold text-primary mb-4">
                    Energetica
                </h1>
                <Link
                    to="/landing-page"
                    className="text-base text-primary hover:opacity-80 transition-opacity underline"
                >
                    Learn more about Energetica
                </Link>
            </div>

            {/* Login Card */}
            <Card className="p-8 shadow-lg">
                <h2 className="text-3xl font-bold text-center mb-6 text-primary">
                    Login
                </h2>

                {/* Error Banner */}
                {error && (
                    <InfoBanner variant="error" className="mb-6">
                        <div dangerouslySetInnerHTML={{ __html: error }} />
                    </InfoBanner>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label
                            htmlFor="username"
                            className="block text-sm font-medium text-primary mb-2"
                        >
                            Username
                        </label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            disabled={isLoading}
                            className="w-full px-4 py-3 rounded-lg border-2 border-pine dark:border-dark-border bg-bone dark:bg-dark-bg-secondary text-primary placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            autoComplete="username"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-primary mb-2"
                        >
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            disabled={isLoading}
                            className="w-full px-4 py-3 rounded-lg border-2 border-pine dark:border-dark-border bg-bone dark:bg-dark-bg-secondary text-primary placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-brand-green disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            autoComplete="current-password"
                        />
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        isLoading={isLoading}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            "Logging in..."
                        ) : (
                            <>
                                <LogIn className="w-5 h-5" />
                                Login
                            </>
                        )}
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
            </Card>
        </div>
    );
}
