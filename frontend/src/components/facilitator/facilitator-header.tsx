/**
 * The top bar of the facilitator pages (#1020 join link, #1022 roster), with a
 * small nav between the two. The parts come from `@energetica/instance`; this
 * app only arranges them with its own routes.
 */

import { Link, useLocation } from "@tanstack/react-router";

import {
    BackToLobbyButton,
    LogOutButton,
    navLinkClassName,
    TopBar,
    TopBarLogo,
} from "@energetica/instance/components/top-bar";
import { ThemeToggle } from "@energetica/ui/components/theme-toggle";

const NAV_LINKS = [
    { to: "/app/facilitator", label: "Join link" },
    { to: "/app/facilitator/players", label: "Players" },
] as const;

export function FacilitatorHeader() {
    const location = useLocation();

    return (
        <TopBar
            nav={NAV_LINKS.map((link) => (
                <Link
                    key={link.to}
                    to={link.to}
                    className={navLinkClassName(location.pathname === link.to)}
                >
                    {link.label}
                </Link>
            ))}
        >
            <Link to="/app">
                <TopBarLogo title="Energetica — Facilitator" />
            </Link>
            <div className="flex items-center gap-2">
                <ThemeToggle variant="icon-only" />
                <BackToLobbyButton />
                <LogOutButton />
            </div>
        </TopBar>
    );
}
