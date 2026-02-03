import { useMatches } from "@tanstack/react-router";

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { navigationConfig } from "@/lib/nav-config";

/**
 * Look up a label for a route path in the navigation config. Returns null if
 * not found.
 */
function findLabelInNavConfig(pathname: string): string | null {
    // Search through navigation config for matching route
    for (const item of navigationConfig) {
        switch (item.type) {
            case "link":
                if (item.to === pathname) {
                    return item.label;
                }
                break;
            case "dropdown":
                // Check parent label
                for (const child of item.children) {
                    if (child.to === pathname) {
                        return child.label;
                    }
                }
                break;
            default:
                throw item satisfies never;
        }
    }
    return null;
}

/** Generate breadcrumbs from pathname using navigation config labels. */
function generateBreadcrumbs(pathname: string): string[] {
    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbs: string[] = [];

    // Build breadcrumbs by constructing full paths and looking them up
    let currentPath = "";
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (!segment) continue; // Skip undefined segments

        currentPath += "/" + segment;

        // Skip the first "app" segment as it's redundant
        if (segment === "app") continue;

        // Try to find label in nav config first
        const navLabel = findLabelInNavConfig(currentPath);

        // Fall back to capitalizing the segment
        const label =
            navLabel || segment.charAt(0).toUpperCase() + segment.slice(1);

        breadcrumbs.push(label);
    }

    return breadcrumbs;
}

export function Breadcrumbs() {
    const matches = useMatches();
    const currentMatch = matches[matches.length - 1];
    const pathname = currentMatch?.pathname || "/app";
    const breadcrumbs = generateBreadcrumbs(pathname);
    return (
        <>
            {breadcrumbs.length > 0 && (
                <>
                    <Breadcrumb>
                        <BreadcrumbList>
                            {breadcrumbs.map((crumb, index) => (
                                <div key={crumb} className="contents">
                                    {index > 0 && <BreadcrumbSeparator />}
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>{crumb}</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </div>
                            ))}
                        </BreadcrumbList>
                    </Breadcrumb>
                </>
            )}
        </>
    );
}
