import { createFileRoute, redirect } from "@tanstack/react-router";

import { fetchCurrentUser } from "@/contexts/auth-context";
import { takePendingJoinToken } from "@/lib/join";
import { queryClient, queryKeys } from "@/lib/query-client";

export const Route = createFileRoute("/app/")({
    loader: async () => {
        // A join in progress (#1021) wins over the ordinary role-based landing below: a visitor
        // who followed a join link while signed out was sent off to the lobby to log in/sign up
        // and is bouncing back here now — `takePendingJoinToken` is how `/app/join/$token`
        // survives that cross-origin round trip (the lobby's `?return=` bounce only ever lands on
        // this bare `/app` root, see `lib/join.ts`). Checked, and consumed, before touching
        // `auth.me`: a visitor in this state is real per the SSO cookie but not yet
        // access-allowed, and `fetchCurrentUser` reads that as `null` (#1021) — falling through to
        // the role-based redirect below would bounce them straight back to the lobby and loop.
        const pendingJoinToken = takePendingJoinToken();
        if (pendingJoinToken !== null) {
            throw redirect({
                to: "/app/join/$token",
                params: { token: pendingJoinToken },
            });
        }

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
