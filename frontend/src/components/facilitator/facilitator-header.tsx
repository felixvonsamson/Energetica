/**
 * Shared shell for the facilitator surfaces (#1020 join link, #1022 roster):
 * the topbar plus a small nav between the two pages.
 *
 * Deliberately doesn't use `GameLayout`/`AppSidebar` — those assume a settled
 * player (capability flags, money, workers), none of which an admin account
 * has.
 */

import { Link, useLocation } from "@tanstack/react-router";

import Logo from "@/assets/simplified_logo.svg?react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
    { to: "/app/facilitator", label: "Join link" },
    { to: "/app/facilitator/roster", label: "Roster" },
] as const;

export function FacilitatorHeader() {
    const location = useLocation();

    return (
        <header className="shrink-0 flex flex-col border-b border-border-brand bg-topbar">
            <div className="flex h-(--topbar-height) items-center justify-between px-4">
                <Link to="/app" className="flex items-center gap-1.5">
                    <Logo className="size-10 fill-foreground" />
                    <span className="font-titles text-lg">
                        Energetica — Facilitator
                    </span>
                </Link>
                <div className="flex items-center gap-2">
                    <ThemeToggle variant="icon-only" />
                    <Button variant="outline" asChild>
                        <Link to="/app/logout">Log out</Link>
                    </Button>
                </div>
            </div>
            <nav className="flex gap-4 px-4">
                {NAV_LINKS.map((link) => {
                    const isActive = location.pathname === link.to;
                    return (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={cn(
                                "border-b-2 px-1 pb-2 text-sm font-medium transition-colors",
                                isActive
                                    ? "border-foreground text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {link.label}
                        </Link>
                    );
                })}
            </nav>
        </header>
    );
}
