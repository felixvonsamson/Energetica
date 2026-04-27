import { type ReactNode } from "react";

import { GameLayout } from "@/components/layout/game-layout";
import { MdxContent } from "@/components/mdx-content";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { WikiSidebar } from "@/components/wiki/wiki-sidebar";
import { useAuth } from "@/hooks/use-auth";

interface WikiLayoutProps {
    children: ReactNode;
}

export function WikiLayout({ children }: WikiLayoutProps) {
    const { isAuthenticated } = useAuth();

    const content = (
        <div className="bg-background text-foreground px-6 lg:px-8 pb-24">
            <MdxContent>{children}</MdxContent>
        </div>
    );

    if (isAuthenticated) {
        return (
            <GameLayout sidebar={<WikiSidebar showBackToGame />}>
                {content}
            </GameLayout>
        );
    }

    return (
        <SidebarProvider>
            <div className="flex h-screen w-full bg-background text-foreground">
                <WikiSidebar />
                <SidebarInset>
                    <main className="flex-1 overflow-auto">
                        <div className="max-w-[1400px] mx-auto">
                            {content}
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}
