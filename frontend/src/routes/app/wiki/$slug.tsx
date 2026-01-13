/** Dynamic route for wiki pages. Loads MDX content based on the slug parameter. */

import { createFileRoute } from "@tanstack/react-router";
import { JSX, useEffect } from "react";

import { WikiLayout } from "@/components/wiki/wiki-layout";

// Eagerly import all MDX files (no lazy loading - all bundled together)
// This adds ~50-100KB to the bundle but eliminates navigation delays
const wikiModules = import.meta.glob<{ default: () => JSX.Element }>(
    "@/content/wiki/*.mdx",
    { eager: true },
);

// Convert to a simple lookup map
const wikiPages: Record<string, () => JSX.Element> = Object.fromEntries(
    Object.entries(wikiModules).map(([path, module]) => {
        // Extract slug from path: "@/content/wiki/introduction.mdx" -> "introduction"
        const slug = path.match(/\/([^/]+)\.mdx$/)?.[1] ?? "";
        return [slug, module.default];
    }),
);

export const Route = createFileRoute("/app/wiki/$slug")({
    component: WikiPage,
    staticData: {
        title: "Game Wiki",
    },
});

/** Wrapper component that scrolls to hash anchor after content loads */
function ContentWithHashScroll({ children }: { children: React.ReactNode }) {
    useEffect(() => {
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
    }, []);

    return <>{children}</>;
}

function WikiPage() {
    const { slug } = Route.useParams();
    const Content = wikiPages[slug];

    if (!Content) {
        return (
            <WikiLayout>
                <div className="text-center py-12">
                    <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
                    <p className="text-lg">
                        The wiki page "{slug}" does not exist.
                    </p>
                </div>
            </WikiLayout>
        );
    }

    return (
        <WikiLayout>
            <ContentWithHashScroll>
                <Content />
            </ContentWithHashScroll>
        </WikiLayout>
    );
}
