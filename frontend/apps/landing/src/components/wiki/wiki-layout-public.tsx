import { MdxContent } from "@energetica/content/components/mdx-content";
import {
    SidebarInset,
    SidebarProvider,
} from "@energetica/ui/components/sidebar";
import { type ReactNode } from "react";

import { WikiSidebarPublic } from "@/components/wiki/wiki-sidebar-public";

interface WikiLayoutPublicProps {
    children: ReactNode;
}

export function WikiLayoutPublic({ children }: WikiLayoutPublicProps) {
    return (
        <SidebarProvider>
            <div className="flex h-screen w-full bg-background text-foreground">
                <WikiSidebarPublic />
                <SidebarInset>
                    <main className="flex-1 overflow-auto">
                        <div className="max-w-[1400px] mx-auto">
                            <div className="bg-background text-foreground px-6 lg:px-8 pb-24">
                                <MdxContent>{children}</MdxContent>
                            </div>
                        </div>
                    </main>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}
