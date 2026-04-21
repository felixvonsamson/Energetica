import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Users } from "lucide-react";

import Logo from "@/assets/icon.svg?react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TypographyBrand } from "@/components/ui/typography";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin-dashboard")({
    component: AdminDashboardLayout,
    staticData: {
        title: "Admin Dashboard",
        routeConfig: { requiredRole: "admin" },
    },
});

function AdminDashboardLayout() {
    const { user } = useAuth();

    return (
        <div className="flex h-svh w-full">
            <aside className="w-56 shrink-0 border-r flex flex-col gap-2 p-4">
                <div className="flex items-center gap-2 mb-4">
                    <Logo className="size-6" />
                    <TypographyBrand className="text-base">Admin</TypographyBrand>
                </div>

                <nav className="flex flex-col gap-1">
                    <Link
                        to="/admin-dashboard"
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors [&.active]:bg-accent [&.active]:font-medium"
                        activeOptions={{ exact: true }}
                    >
                        <Users size={16} />
                        Players
                    </Link>
                </nav>

                <div className="mt-auto flex flex-col gap-2">
                    <div className="text-xs text-muted-foreground px-3">
                        Signed in as <span className="font-medium">{user?.username}</span>
                    </div>
                    <div className="flex items-center justify-between px-3">
                        <Link
                            to="/app/logout"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Log out
                        </Link>
                        <ThemeToggle />
                    </div>
                </div>
            </aside>

            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>

            <Toaster position="top-center" richColors />
        </div>
    );
}
