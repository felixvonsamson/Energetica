/** Logout page — hands off to the lobby, which owns the single session cookie. */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { Spinner } from "@/components/ui/spinner";
import { lobbyHref } from "@/lib/instances";

function LogoutComponent() {
    useEffect(() => {
        // The session is a parent-domain cookie the lobby minted; only a global logout at the
        // lobby clears it (ADR-0002). Full-page, cross-origin redirect to lobby.{apex}/logout,
        // which clears the cookie and returns to the login page.
        window.location.assign(lobbyHref("/logout"));
    }, []);

    return (
        <div className="flex min-h-screen items-center justify-center">
            <Spinner />
        </div>
    );
}

export const Route = createFileRoute("/app/logout")({
    component: LogoutComponent,
    staticData: { title: "Logging out..." },
});
