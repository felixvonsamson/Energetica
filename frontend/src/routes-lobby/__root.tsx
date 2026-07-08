import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { LogOut, UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TypographyBrand } from "@/components/ui/typography";
import { useLobbyLogout, useMyRuns } from "@/hooks/use-lobby";

export const Route = createRootRoute({
    staticData: { title: "" },
    component: RootComponent,
});

/**
 * The lobby shell: a slim header (wordmark + "lobby" chip, theme toggle, and a
 * global logout when authenticated) over a narrow centered column — a front
 * door, not a dashboard.
 */
function RootComponent() {
    const { data: myRuns } = useMyRuns();
    const logout = useLobbyLogout();

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="w-full max-w-3xl mx-auto flex flex-row items-center justify-between px-6 py-4">
                <Link to="/" className="flex flex-row items-baseline gap-2">
                    <TypographyBrand className="text-2xl text-primary">
                        Energetica
                    </TypographyBrand>
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground border border-border rounded-full px-2 py-0.5">
                        Lobby
                    </span>
                </Link>
                <div className="flex flex-row items-center gap-1">
                    <ThemeToggle />
                    {myRuns != null && (
                        <>
                            <Link to="/account">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1.5"
                                >
                                    <UserCog className="w-4 h-4" />
                                    Account
                                </Button>
                            </Link>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => logout.mutate()}
                                disabled={logout.isPending}
                                className="gap-1.5"
                            >
                                <LogOut className="w-4 h-4" />
                                Log out
                            </Button>
                        </>
                    )}
                </div>
            </header>
            <main className="flex-1 w-full max-w-3xl mx-auto px-6 pb-16">
                <Outlet />
            </main>
        </div>
    );
}
