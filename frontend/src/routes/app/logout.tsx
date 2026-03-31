/** Logout page - Clears session and redirects to login. */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { useLogout } from "@/hooks/use-auth-queries";

function LogoutComponent() {
    const navigate = useNavigate();
    const logout = useLogout();
    const hasLoggedOut = useRef(false);

    useEffect(() => {
        // Guard against React StrictMode's double effect invocation.
        // Refs survive the simulated unmount/remount, so this fires only once.
        if (hasLoggedOut.current) return;
        hasLoggedOut.current = true;

        logout.mutateAsync().finally(() => {
            navigate({ to: "/app/login" });
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div>Logging out...</div>;
}

export const Route = createFileRoute("/app/logout")({
    component: LogoutComponent,
    staticData: { title: "Logging out..." },
});
