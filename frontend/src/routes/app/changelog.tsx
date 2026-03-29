/** Changelog page - Displays MDX content with game version history. */

import { createFileRoute } from "@tanstack/react-router";

import { HomeLayout } from "@/components/home-layout";
import { GameLayout } from "@/components/layout/game-layout";
import { MdxContent } from "@/components/mdx-content";
import ChangelogContent from "@/content/changelog.mdx";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/changelog")({
    component: ChangelogPage,
    staticData: { title: "Changelog" },
});

function ChangelogPage() {
    const { isAuthenticated } = useAuth();

    const content = (
        <div className="bg-background text-foreground px-6 lg:px-8 py-12 pb-24">
            <MdxContent>
                <ChangelogContent />
            </MdxContent>
        </div>
    );

    return isAuthenticated ? (
        <GameLayout>{content}</GameLayout>
    ) : (
        <HomeLayout>{content}</HomeLayout>
    );
}
