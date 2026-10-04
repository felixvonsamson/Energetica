/**
 * The body of a Workshop page whose content is not built yet. The page exists
 * so the timeline has somewhere to link to.
 */

import type { ReactNode } from "react";

import { TypographyH2, TypographyMuted } from "@/components/ui/typography";

export function WorkshopPlaceholder({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-2">
            <TypographyH2>{title}</TypographyH2>
            <TypographyMuted>{children}</TypographyMuted>
        </div>
    );
}
