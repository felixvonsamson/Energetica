/**
 * Main game layout component. Provides the structure for all game pages with
 * sidebar navigation, top bar, and content area.
 */

import { type ReactNode, useEffect, useState } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

interface GameLayoutProps {
    children: ReactNode;
}

export function GameLayout({ children }: GameLayoutProps) {
    const [scrollPosition, setScrollPosition] = useState(0);

    useEffect(() => {
        document.body.classList.add("has-topbar");
        return () => document.body.classList.remove("has-topbar");
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLElement>) => {
        const target = e.target as HTMLElement;
        setScrollPosition(target.scrollTop);
    };

    return (
        <SidebarProvider>
            <div className="flex h-svh w-full flex-col overflow-hidden">
                {/* Top bar spans full width above sidebar */}
                <TopBar />

                {/* Sidebar + content row */}
                <div className="flex flex-1 min-h-0">
                    <AppSidebar scrollPosition={scrollPosition} />
                    <SidebarInset>
                        <main
                            className="flex-1 overflow-auto 2xl:px-50"
                            onScroll={handleScroll}
                        >
                            {children}
                        </main>
                        <Toaster position="top-center" richColors />
                    </SidebarInset>
                </div>
            </div>
        </SidebarProvider>
    );
}
