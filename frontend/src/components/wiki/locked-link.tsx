import { Link, type LinkProps } from "@tanstack/react-router";

import { useHasCapability } from "@/hooks/use-capabilities";
import type { PlayerCapabilities } from "@/types/capabilities";
import type { LockedLinkProps } from "@energetica/content/wiki-pages";

/**
 * A link that only works once the player has the capability. The wiki pages
 * write `to` and `capability` as plain strings, so they are not type-checked.
 */
export function LockedLink({ children, to, capability }: LockedLinkProps) {
    const hasCapability = useHasCapability(
        capability as keyof PlayerCapabilities,
    );

    if (hasCapability) {
        return <Link to={to as LinkProps["to"]}>{children}</Link>;
    }

    return (
        <span
            className="cursor-not-allowed underline decoration-dashed text-muted-foreground"
            title="Not unlocked"
        >
            {children}
        </span>
    );
}
