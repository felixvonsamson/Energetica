import type { ReactNode } from "react";

import { ContentLink, InertLink } from "#content/components/content-link";
import { useContentHost } from "#content/host-context";

export interface LockedLinkProps {
    /** The game page to link to, such as `/app/facilities/power-priorities`. */
    to: string;
    /** The player capability that unlocks the page, such as `has_network`. */
    capability: string;
    children: ReactNode;
}

/** A link to a game page that only works once the player has the capability. */
export function LockedLink({ to, capability, children }: LockedLinkProps) {
    const { servesGame, useHasCapability } = useContentHost();
    const unlocked = useHasCapability(capability);

    // Where there is no game, ContentLink shows the page as unavailable instead.
    if (servesGame && !unlocked) {
        return <InertLink title="Not unlocked">{children}</InertLink>;
    }
    return <ContentLink href={to}>{children}</ContentLink>;
}
