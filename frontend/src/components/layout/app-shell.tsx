import { Link } from "@tanstack/react-router";

import Logo from "@/assets/icon.svg?react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TypographyBrand } from "@/components/ui/typography";

/**
 * Page chrome for app-bundle pages that live outside the authenticated game
 * shell: login, sign-up, the unauthenticated changelog, and the internal
 * design-system tools.
 *
 * Deliberately carries no marketing navigation. The landing site (The Game /
 * For Educators / The Project) is served by Apache from the apex domain — a
 * separate origin from any instance subdomain — so it cannot be reached via
 * in-bundle TanStack routes. Cross-origin links to it use `<a href>` composed
 * by `landingHref`, not this chrome. The old shared marketing `HomeLayout`
 * (Header/Footer) is now landing-only.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background">
            <div className="overflow-y-scroll h-screen">
                <div className="min-h-screen flex flex-col">
                    <header className="flex items-center justify-between px-6 py-6 lg:px-[15%]">
                        <Link to="/app" className="flex items-center gap-2">
                            <Logo className="size-9 fill-foreground" />
                            <TypographyBrand className="text-2xl text-foreground">
                                Energetica
                            </TypographyBrand>
                        </Link>
                        <ThemeToggle />
                    </header>
                    <div className="lg:px-[15%] flex-1">{children}</div>
                </div>
            </div>
        </div>
    );
}
