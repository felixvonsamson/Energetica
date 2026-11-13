import {
    documentTitle,
    pageTitleFromMatches,
} from "@energetica/core/document-title";
import { Button } from "@energetica/ui/components/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@energetica/ui/components/dropdown-menu";
import { ThemeToggle } from "@energetica/ui/components/theme-toggle";
import { TypographyBrand } from "@energetica/ui/components/typography";
import {
    createRootRoute,
    HeadContent,
    Link,
    Outlet,
} from "@tanstack/react-router";
import { CircleUser, ExternalLink, LogOut, Settings } from "lucide-react";

import { useLobbyLogout, useMyRuns } from "@/hooks/use-lobby";
import { lobbyLandingHref } from "@/lib/lobby";

export const Route = createRootRoute({
    staticData: { title: "" },
    head: ({ matches }) => ({
        meta: [{ title: documentTitle(pageTitleFromMatches(matches)) }],
    }),
    component: RootComponent,
});

/**
 * The lobby shell: a slim header over a narrow centered column — a front door,
 * not a dashboard. The header holds the wordmark, a "Website" link back to the
 * landing page, the theme toggle and, when signed in, the account menu.
 */
function RootComponent() {
    const { data: myRuns } = useMyRuns();

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <HeadContent />
            {/* Wraps on narrow phones: the controls drop to their own
                right-aligned row instead of overflowing. */}
            <header className="w-full max-w-3xl mx-auto flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-4">
                <Link to="/" className="flex flex-row items-baseline gap-2">
                    <TypographyBrand className="text-2xl text-primary">
                        Energetica
                    </TypographyBrand>
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground border border-border rounded-full px-2 py-0.5">
                        Lobby
                    </span>
                </Link>
                <div className="ml-auto flex flex-row items-center gap-1">
                    {/* Cross-origin: the landing page is another app. */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        asChild
                    >
                        <a href={lobbyLandingHref("/")}>
                            Website
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </Button>
                    <ThemeToggle />
                    {myRuns != null && (
                        <LobbyAccountMenu username={myRuns.username} />
                    )}
                </div>
            </header>
            <main className="flex-1 w-full max-w-3xl mx-auto px-6 pb-16">
                <Outlet />
            </main>
        </div>
    );
}

/**
 * The lobby's account menu. It matches the run app's `AccountMenu` (same
 * trigger, username label) so the two look alike; sharing one component waits
 * on a React package both bundles can use (#1379).
 */
function LobbyAccountMenu({ username }: { username: string }) {
    const logout = useLobbyLogout();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Account menu">
                    <CircleUser size={20} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel asChild>
                    <p className="truncate">{username}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link to="/account">
                        <Settings size={16} />
                        Account settings
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onSelect={() => logout.mutate()}
                    disabled={logout.isPending}
                >
                    <LogOut size={16} />
                    Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
