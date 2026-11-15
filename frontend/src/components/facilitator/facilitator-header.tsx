/**
 * The top bar of the facilitator pages (#1020 join link, #1022 roster), with a
 * small nav between the two. In a Workshop Run, it also links back to the
 * facilitator's console (#1018). The parts come from `@energetica/instance`;
 * this app only arranges them with its own routes.
 */

import { Link, useLocation } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";

import { useRunMode } from "@/hooks/use-run-mode";
import {
    BackToLobbyButton,
    LogOutButton,
    navLinkClassName,
    TopBar,
    TopBarLogo,
} from "@energetica/instance/components/top-bar";
import { Button } from "@energetica/ui/components/button";
import { ThemeToggle } from "@energetica/ui/components/theme-toggle";

const NAV_LINKS = [
    { to: "/app/facilitator", label: "Join link" },
    { to: "/app/facilitator/players", label: "Players" },
] as const;

export function FacilitatorHeader() {
    const location = useLocation();
    const { data: runMode } = useRunMode();

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
                {runMode === "workshop" && (
                    <Button variant="outline" asChild>
                        <Link to="/app/workshop/console">
                            <SlidersHorizontal className="size-4" />
                            Console
                        </Link>
                    </Button>
                )}
                <BackToLobbyButton />
                <LogOutButton />
            </div>
        </TopBar>
    );
}
