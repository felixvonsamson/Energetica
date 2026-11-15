/**
 * The top bar of the facilitator pages (#1020 join link, #1022 roster), with a
 * small nav between the two and a link back to the facilitator's console
 * (#1018). The parts come from `@energetica/instance`; this app only arranges
 * them with its own routes.
 */

import {
    BackToLobbyButton,
    LogOutButton,
    navLinkClassName,
    TopBar,
    TopBarLogo,
} from "@energetica/instance/components/top-bar";
import { Button } from "@energetica/ui/components/button";
import { ThemeToggle } from "@energetica/ui/components/theme-toggle";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";

const NAV_LINKS = [
    { to: "/facilitator", label: "Join link" },
    { to: "/facilitator/players", label: "Players" },
] as const;

export function FacilitatorHeader() {
    const matchRoute = useMatchRoute();

    return (
        <TopBar
            nav={NAV_LINKS.map((link) => (
                <Link
                    key={link.to}
                    to={link.to}
                    className={navLinkClassName(!!matchRoute({ to: link.to }))}
                >
                    {link.label}
                </Link>
            ))}
        >
            <Link to="/">
                <TopBarLogo title="Energetica — Facilitator" />
            </Link>
            <div className="flex items-center gap-2">
                <ThemeToggle variant="icon-only" />
                <Button variant="outline" asChild>
                    <Link to="/console">
                        <SlidersHorizontal className="size-4" />
                        Console
                    </Link>
                </Button>
                <BackToLobbyButton />
                <LogOutButton />
            </div>
        </TopBar>
    );
}
