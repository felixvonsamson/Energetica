/** Dynamic route for wiki pages. Loads MDX content based on the slug parameter. */

import { createFileRoute } from "@tanstack/react-router";

import { wikiComponents } from "@/components/wiki/wiki-components";
import { WikiLayout } from "@/components/wiki/wiki-layout";
import { wikiPages } from "@energetica/content/wiki-pages";
import {
    TypographyH1,
    TypographyLead,
} from "@energetica/ui/components/typography";

export const Route = createFileRoute("/app/wiki/$slug")({
    component: WikiPage,
    staticData: {
        title: "Game Wiki",
    },
});

function WikiPage() {
    const { slug } = Route.useParams();
    const Content = wikiPages[slug];

    if (!Content) {
        return (
            <WikiLayout>
                <div className="text-center py-12">
                    <TypographyH1 className="mb-4">Page Not Found</TypographyH1>
                    <TypographyLead>
                        The wiki page "{slug}" does not exist.
                    </TypographyLead>
                </div>
            </WikiLayout>
        );
    }

    return (
        <WikiLayout>
            <Content components={wikiComponents} />
        </WikiLayout>
    );
}
