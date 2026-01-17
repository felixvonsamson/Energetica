/**
 * Reusable component for rendering MDX content with prose styling and hash
 * anchor scrolling support. Used by wiki pages and changelog.
 */

import { type ReactNode, useEffect } from "react";

import { cn } from "@/lib/classname-utils";

interface MdxContentProps {
    children: ReactNode;
    /** Optional additional classes for the article wrapper */
    className?: string;
    /** Whether to enable hash anchor scrolling. Default: true */
    enableHashScroll?: boolean;
}

/**
 * Wrapper component for MDX content that provides:
 *
 * - Prose styling for markdown content
 * - Automatic scrolling to hash anchors after content loads
 */
export function MdxContent({
    children,
    className,
    enableHashScroll = true,
}: MdxContentProps) {
    useEffect(() => {
        if (!enableHashScroll) return;

        // After content is mounted, scroll to hash if present
        const hash = window.location.hash;
        if (hash) {
            // Use setTimeout to ensure the DOM is fully rendered
            setTimeout(() => {
                const element = document.getElementById(hash.slice(1));
                if (element) {
                    element.scrollIntoView({ behavior: "smooth" });
                }
            }, 0);
        }
    }, [enableHashScroll]);

    return (
        <article
            className={cn(
                "max-w-4xl mx-auto prose prose-lg dark:prose-invert",
                className,
            )}
        >
            {children}
        </article>
    );
}
