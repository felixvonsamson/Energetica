/**
 * Reusable component for rendering MDX content with prose styling and hash
 * anchor scrolling support. Used by wiki pages and changelog.
 */

import { cn } from "@energetica/ui/lib/utils";
import { useLocation } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";

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
    const { hash } = useLocation();

    useEffect(() => {
        if (!enableHashScroll || !hash) return;

        // Scroll to hash after render. Re-runs whenever the hash changes so
        // wiki-to-wiki navigation (same MdxContent instance, new hash) works.
        setTimeout(() => {
            document
                .getElementById(hash)
                ?.scrollIntoView({ behavior: "smooth" });
        }, 0);
    }, [enableHashScroll, hash]);

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
