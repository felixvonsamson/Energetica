import { type ReactNode } from "react";

interface CatalogGridProps {
    children: ReactNode;
}

/**
 * Responsive grid layout for catalog pages (facilities, technologies).
 *
 * Breakpoints:
 *
 * - Mobile: 1 column
 * - Small (sm): 2 columns
 * - Large (lg): 3 columns
 * - Extra large (xl): 4 columns
 */
export function CatalogGrid({ children }: CatalogGridProps) {
    return (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {children}
        </div>
    );
}
