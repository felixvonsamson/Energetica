import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { wikiNav } from "@energetica/content/wiki-nav";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@energetica/ui/components/sidebar";

interface WikiSidebarProps {
    showBackToGame?: boolean;
}

export function WikiSidebar({ showBackToGame = false }: WikiSidebarProps) {
    const params = useParams({ strict: false });
    const currentSlug = params.slug;

    return (
        <Sidebar
            side="left"
            collapsible="offcanvas"
            className="overflow-hidden"
        >
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {wikiNav.map(({ slug, label, icon: Icon }) => (
                                <SidebarMenuItem key={slug}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={slug === currentSlug}
                                        tooltip={label}
                                    >
                                        <Link
                                            to="/app/wiki/$slug"
                                            params={{ slug }}
                                        >
                                            <Icon className="size-4" />
                                            <span className="text-base">
                                                {label}
                                            </span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            {showBackToGame && (
                <SidebarFooter>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild tooltip="Back to Game">
                                <Link to="/app/dashboard">
                                    <ArrowLeft className="size-4" />
                                    <span className="text-base">
                                        Back to Game
                                    </span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            )}

            <SidebarRail />
        </Sidebar>
    );
}
