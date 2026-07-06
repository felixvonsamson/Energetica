/**
 * Global logout landing.
 *
 * Reached from inside a run (the instance's "Logout" redirects here
 * cross-origin) or from the lobby itself. Clears the single parent-domain
 * session cookie — logging the account out of every run (ADR-0002) — then
 * returns to the login page.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { Spinner } from "@/components/ui/spinner";
import { useLobbyLogout } from "@/hooks/use-lobby";

function LogoutPage() {
    const navigate = useNavigate();
    const logout = useLobbyLogout();
    const hasLoggedOut = useRef(false);

    useEffect(() => {
        // Ref-guard against React StrictMode's double effect invocation so logout fires once.
        if (hasLoggedOut.current) return;
        hasLoggedOut.current = true;

        logout
            .mutateAsync()
            .catch(() => {})
            .finally(() => {
                void navigate({ to: "/login" });
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="flex min-h-screen items-center justify-center">
            <Spinner />
        </div>
    );
}

export const Route = createFileRoute("/logout")({
    component: LogoutPage,
    staticData: { title: "Logging out..." },
});
