import { wikiPages } from "@energetica/content/wiki-pages";
import {
    TypographyH1,
    TypographyLead,
} from "@energetica/ui/components/typography";
import { createFileRoute } from "@tanstack/react-router";

import { wikiComponents } from "@/components/wiki/wiki-components";
import { WikiLayoutPublic } from "@/components/wiki/wiki-layout-public";

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
            <Content components={wikiComponents} />
        </WikiLayoutPublic>
    );
}
