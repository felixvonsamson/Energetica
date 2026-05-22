import { type ReactNode } from "react";

import { GameLayout } from "@/components/layout/game-layout";
import { MdxContent } from "@/components/mdx-content";
import { WikiLayoutPublic } from "@/components/wiki/wiki-layout-public";
import { WikiSidebar } from "@/components/wiki/wiki-sidebar";
import { useAuth } from "@/hooks/use-auth";

interface WikiLayoutProps {
    children: ReactNode;
}

export function WikiLayout({ children }: WikiLayoutProps) {
    const { isAuthenticated } = useAuth();

    if (isAuthenticated) {
        return (
            <GameLayout sidebar={<WikiSidebar showBackToGame />}>
                <div className="bg-background text-foreground px-6 lg:px-8 pb-24">
                    <MdxContent>{children}</MdxContent>
                </div>
            </GameLayout>
        );
    }

    return <WikiLayoutPublic>{children}</WikiLayoutPublic>;
}
