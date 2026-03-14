/**
 * Main game layout component. Provides the structure for all game pages with
 * sidebar navigation, top bar, and content area.
 */

import { type ReactNode, useState } from "react";
import { Toaster } from "sonner";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface GameLayoutProps {
    children: ReactNode;
}

export function GameLayout({ children }: GameLayoutProps) {
    const [scrollPosition, setScrollPosition] = useState(0);

    const handleScroll = (e: React.UIEvent<HTMLElement>) => {
        const target = e.target as HTMLElement;
        setScrollPosition(target.scrollTop);
    };

    return (
        <SidebarProvider>
            <AppSidebar scrollPosition={scrollPosition} />
            <SidebarInset>
                <div className="flex h-screen flex-col">
                    {/* Top bar with resources and notifications */}
                    <TopBar />

                    {/* Main content area */}
                    <main
                        className="flex-1 overflow-auto 2xl:px-50"
                        onScroll={handleScroll}
                    >
                        {children}
                    </main>

                    <Toaster position="top-right" richColors />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
