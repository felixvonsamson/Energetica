/**
 * Main game layout component. Provides the structure for all game pages with
 * sidebar navigation, top bar, and content area.
 */

import { type ReactNode, useEffect, useRef } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

interface GameLayoutProps {
    children: ReactNode;
    sidebar?: ReactNode;
}

export function GameLayout({ children, sidebar }: GameLayoutProps) {
    const bgLogoRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        document.body.classList.add("has-topbar");
        return () => document.body.classList.remove("has-topbar");
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLElement>) => {
        if (!bgLogoRef.current) return;
        const scrollTop = (e.target as HTMLElement).scrollTop;
        const rotation = -(scrollTop / 10000) * 360;
        bgLogoRef.current.style.transform = `rotate(${rotation}deg)`;
    };

    return (
        <SidebarProvider>
            <div className="flex h-svh w-full flex-col overflow-hidden">
                {/* Top bar spans full width above sidebar */}
                <TopBar />

                {/* Sidebar + content row */}
                <div className="flex flex-1 min-h-0">
                    {sidebar ?? <AppSidebar bgLogoRef={bgLogoRef} />}
                    <SidebarInset className="min-w-0">
                        <main
                            className="flex-1 overflow-auto min-w-0"
                            onScroll={handleScroll}
                        >
                            <div className="max-w-[1400px] mx-auto">
                                {children}
                            </div>
                        </main>
                        <Toaster position="top-center" richColors offset="calc(var(--topbar-height) + 0.5rem)" />
                    </SidebarInset>
                </div>
            </div>
        </SidebarProvider>
    );
}
