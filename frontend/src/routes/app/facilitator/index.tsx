/**
 * Facilitator settings page (#1020): the join link/QR code for this private
 * instance, and the "allow joining" toggle gating it, from
 * `@energetica/instance`.
 *
 * Deliberately doesn't use `GameLayout`/`AppSidebar` — those assume a settled
 * player (capability flags, money, workers), none of which a facilitator
 * account has. This page is a small, self-contained shell instead.
 */

import { createFileRoute } from "@tanstack/react-router";

import { FacilitatorHeader } from "@/components/facilitator/facilitator-header";
import { getUserFriendlyError } from "@/lib/error-utils";
import { JoinLinkCard } from "@energetica/instance/components/join-link-card";

function FacilitatorHelp() {
    return (
        <div className="space-y-3">
            <p>
                Share the join link or QR code below with the people you want to
                let into this instance. While "Allow joining" is off, the link
                shows a "contact the administrator" message instead of letting
                anyone in.
            </p>
        </div>
    );
}

export const Route = createFileRoute("/app/facilitator/")({
    component: FacilitatorPage,
    staticData: {
        title: "Facilitator",
        routeConfig: { requiredRole: "facilitator" },
        infoDialog: { contents: <FacilitatorHelp /> },
    },
});

function FacilitatorPage() {
    return (
        <div className="flex min-h-svh flex-col">
            <FacilitatorHeader />
            <main className="flex-1 overflow-auto p-4 md:p-8">
                <div className="max-w-xl mx-auto">
                    <JoinLinkCard
                        joinPath={(token) => `/app/join/${token}`}
                        formatError={getUserFriendlyError}
                    />
                </div>
            </main>
        </div>
    );
}
