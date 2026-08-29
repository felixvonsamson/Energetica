import { createFileRoute, redirect } from "@tanstack/react-router";

import { fetchCurrentUser } from "@/contexts/auth-context";
import { queryClient, queryKeys } from "@/lib/query-client";

export const Route = createFileRoute("/app/")({
    loader: async () => {
        // Role-aware so an admin account lands on its own home (#1020) instead of bouncing
        // through the player-only `/app/dashboard`, which `__root.tsx`'s route guard would then
        // redirect straight to `/app/logout` (a role mismatch on a gated route always logs out —
        // see `computeRedirect` in `lib/route-guard.ts`). `ensureQueryData` reads the same
        // `queryKeys.auth.me` cache `AuthProvider` populates (the module-level singleton, not
        // router context — the root route isn't `createRootRouteWithContext`-typed), awaiting the
        // fetch if it hasn't resolved yet rather than racing it; an unauthenticated visitor
        // (`user` is `null`) still falls through to `/app/dashboard`, whose own guard sends them
        // to log in — unchanged.
        const user = await queryClient.ensureQueryData({
            queryKey: queryKeys.auth.me,
            queryFn: fetchCurrentUser,
            staleTime: Infinity,
        });
        throw redirect({
            to: user?.role === "admin" ? "/app/facilitator" : "/app/dashboard",
        });
    },
    staticData: {
        title: "",
    },
});
