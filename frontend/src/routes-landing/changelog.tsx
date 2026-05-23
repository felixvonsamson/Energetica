import { createFileRoute } from "@tanstack/react-router";

import { HomeLayout } from "@/components/home-layout";
import { MdxContent } from "@/components/mdx-content";
import ChangelogContent from "@/content/changelog.mdx";

export const Route = createFileRoute("/changelog")({
    component: ChangelogPage,
    staticData: { title: "Changelog" },
});

function ChangelogPage() {
    return (
        <HomeLayout>
            <div className="bg-background text-foreground px-6 lg:px-8 py-12 pb-24">
                <MdxContent>
                    <ChangelogContent />
                </MdxContent>
            </div>
        </HomeLayout>
    );
}
