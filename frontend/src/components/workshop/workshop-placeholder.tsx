/** The body of a Workshop page that its own ticket has not built yet (#995). */

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
