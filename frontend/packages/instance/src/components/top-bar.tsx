/**
 * Parts for the top bar of the pages outside the game, such as the join page
 * and the facilitator pages (#1020, #1021, #1022). Each app arranges them with
 * its own navigation, since the apps serve these pages at different paths.
 *
 * These pages deliberately don't use the game's layout and sidebar — those
 * assume a settled player (capability flags, money, workers), which neither a
 * visitor joining nor a facilitator account has.
 */

import { lobbyHref } from "@energetica/core/instances";
import Logo from "@energetica/ui/assets/simplified_logo.svg?react";
import { Button } from "@energetica/ui/components/button";
import { cn } from "@energetica/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * The bar itself: `children` on one row, spread to either end, and an optional
 * row of `nav` links below.
 */
export function TopBar({
    children,
    nav,
}: {
    children: ReactNode;
    nav?: ReactNode;
}) {
    return (
        <header className="shrink-0 flex flex-col border-b border-border-brand bg-topbar">
            <div className="flex h-(--topbar-height) items-center justify-between px-4">
                {children}
            </div>
            {nav && <nav className="flex gap-4 px-4">{nav}</nav>}
        </header>
    );
}

/** The logo and a title. Wrap it in a link to make it one. */
export function TopBarLogo({ title = "Energetica" }: { title?: string }) {
    return (
        <span className="flex items-center gap-1.5">
            <Logo className="size-10 fill-foreground" />
            <span className="font-titles text-lg">{title}</span>
        </span>
    );
}

/** The class of a link in the top bar's `nav` row, underlined when active. */
export function navLinkClassName(isActive: boolean): string {
    return cn(
        "border-b-2 px-1 pb-2 text-sm font-medium transition-colors",
        isActive
            ? "border-foreground text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
    );
}

export function BackToLobbyButton() {
    return (
        <Button variant="outline" asChild>
            <a href={lobbyHref("/")}>Back to lobby</a>
        </Button>
    );
}

/**
 * Logs out at the lobby, which owns the single session cookie: only its logout
 * page can clear it (ADR-0002).
 */
export function LogOutButton({ size }: { size?: "sm" }) {
    return (
        <Button variant="outline" size={size} asChild>
            <a href={lobbyHref("/logout")}>Log out</a>
        </Button>
    );
}
