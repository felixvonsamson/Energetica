import { Changelog } from "@energetica/content/changelog";
import { MdxContent } from "@energetica/content/components/mdx-content";
import { createFileRoute } from "@tanstack/react-router";

import { HomeLayout } from "@/components/home-layout";
import { contentHost } from "@/lib/content-host";

export const Route = createFileRoute("/changelog")({
    component: ChangelogPage,
    staticData: { title: "Changelog" },
});

function ChangelogPage() {
    return (
        <HomeLayout>
            <div className="bg-background text-foreground px-6 lg:px-8 py-12 pb-24">
                <MdxContent>
                    <Changelog host={contentHost} />
                </MdxContent>
            </div>
        </HomeLayout>
    );
}
