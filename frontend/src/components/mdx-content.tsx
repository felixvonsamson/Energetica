/**
 * Reusable component for rendering MDX content with prose styling and hash
 * anchor scrolling support. Used by wiki pages and changelog.
 */

import { useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

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
    const navigate = useNavigate();
    const { hash } = useLocation();
    const articleRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const article = articleRef.current;
        if (!article) return;

        function handleClick(e: MouseEvent) {
            const anchor = (e.target as HTMLElement).closest("a");
            if (!anchor) return;
            const href = anchor.getAttribute("href");
            const mdxMatch = href?.match(/^\.\/([^#]+)\.mdx(#.*)?$/);
            if (mdxMatch) {
                e.preventDefault();
                navigate({
                    to: "/app/wiki/$slug",
                    params: { slug: mdxMatch[1]! },
                    hash: mdxMatch[2]?.slice(1),
                });
            }
        }

        article.addEventListener("click", handleClick);
        return () => article.removeEventListener("click", handleClick);
    }, [navigate]);

    useEffect(() => {
        if (!enableHashScroll || !hash) return;

        // Scroll to hash after render. Re-runs whenever the hash changes so
        // wiki-to-wiki navigation (same MdxContent instance, new hash) works.
        setTimeout(() => {
            document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
        }, 0);
    }, [enableHashScroll, hash]);

    return (
        <article
            ref={articleRef}
            className={cn(
                "max-w-4xl mx-auto prose prose-lg dark:prose-invert",
                className,
            )}
        >
            {children}
        </article>
    );
}
