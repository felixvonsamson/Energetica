/**
 * Main game layout component. Provides the structure for all game pages with
 * sidebar navigation, top bar, and content area.
 */

import { type ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface GameLayoutProps {
    children: ReactNode;
}

export function GameLayout({ children }: GameLayoutProps) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <div className="flex h-screen flex-col">
                    {/* Top bar with resources and notifications */}
                    <TopBar />

                    {/* Main content area */}
                    <main className="flex-1 overflow-auto 2xl:px-50">
                        {children}
                    </main>

                    {/* Toast notifications container */}
                    <div
                        id="toasts"
                        className="fixed top-4 right-4 z-50 flex flex-col gap-2"
                    ></div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
