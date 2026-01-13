/**
 * Main game layout component. Provides the structure for all game pages with
 * navigation, top bar, and content area.
 */

import { type ReactNode } from "react";

import { TopBar } from "@/components/layout/top-bar";
import { NavigationProvider } from "@/contexts/navigation-context";

interface GameLayoutProps {
    children: ReactNode;
}

export function GameLayout({ children }: GameLayoutProps) {
    return (
        <NavigationProvider>
            <div className="bg-background text-foreground flex flex-col min-h-screen">
                {/* Top bar with resources, notifications, and navigation */}
                <TopBar />

                {/* Main content area */}
                <main className="flex-1 2xl:px-50">{children}</main>

                {/* Toast notifications container */}
                <div
                    id="toasts"
                    className="fixed top-4 right-4 z-50 flex flex-col gap-2"
                ></div>
            </div>
        </NavigationProvider>
    );
}
