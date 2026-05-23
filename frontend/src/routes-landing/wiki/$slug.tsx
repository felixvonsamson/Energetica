import { createFileRoute } from "@tanstack/react-router";
import { JSX } from "react";

import { TypographyH1, TypographyLead } from "@/components/ui/typography";
import { WikiLayoutPublic } from "@/components/wiki/wiki-layout-public";

const wikiModules = import.meta.glob<{ default: () => JSX.Element }>(
    "@/content/wiki/*.mdx",
    { eager: true },
);

const wikiPages: Record<string, () => JSX.Element> = Object.fromEntries(
    Object.entries(wikiModules).map(([path, module]) => {
        const slug = path.match(/\/([^/]+)\.mdx$/)?.[1] ?? "";
        return [slug, module.default];
    }),
);

export const Route = createFileRoute("/wiki/$slug")({
    component: WikiPage,
    staticData: { title: "Game Wiki" },
});

function WikiPage() {
    const { slug } = Route.useParams();
    const Content = wikiPages[slug];

    if (!Content) {
        return (
            <WikiLayoutPublic>
                <div className="text-center py-12">
                    <TypographyH1 className="mb-4">Page Not Found</TypographyH1>
                    <TypographyLead>
                        The wiki page "{slug}" does not exist.
                    </TypographyLead>
                </div>
            </WikiLayoutPublic>
        );
    }

    return (
        <WikiLayoutPublic>
            <Content />
        </WikiLayoutPublic>
    );
}
