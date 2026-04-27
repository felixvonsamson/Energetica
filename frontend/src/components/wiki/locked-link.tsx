import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";

import { useHasCapability } from "@/hooks/use-capabilities";
import type { PlayerCapabilities } from "@/types/capabilities";

interface LockedLinkProps {
    children: ReactNode;
    to: string;
    capability: keyof PlayerCapabilities;
}

export function LockedLink({ children, to, capability }: LockedLinkProps) {
    const hasCapability = useHasCapability(capability);

    if (hasCapability) {
        return <Link to={to}>{children}</Link>;
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
