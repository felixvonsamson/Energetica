import { type ReactNode } from "react";

interface CatalogGridProps {
    children: ReactNode;
}

export function CatalogGrid({ children }: CatalogGridProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {children}
        </div>
    );
}
