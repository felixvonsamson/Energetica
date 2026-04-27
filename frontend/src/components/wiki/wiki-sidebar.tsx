import { Link , useParams } from "@tanstack/react-router";
import {
    ArrowLeft,
    BatteryFull,
    BookOpen,
    Clock,
    FlaskConical,
    Leaf,
    Map,
    Network,
    SlidersVertical,
    Warehouse,
    Zap,
    Gem,
    Hammer,
} from "lucide-react";

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
} from "@/components/ui/sidebar";

const wikiLinks = [
    { slug: "introduction", label: "Introduction", icon: BookOpen },
    { slug: "map", label: "The Map", icon: Map },
    { slug: "projects", label: "Projects", icon: Hammer },
    { slug: "power-facilities", label: "Power Facilities", icon: Zap },
    { slug: "storage-facilities", label: "Storage Facilities", icon: BatteryFull },
    { slug: "resources", label: "Natural Resources", icon: Gem },
    { slug: "functional-facilities", label: "Functional Facilities", icon: Warehouse },
    { slug: "technologies", label: "Technology", icon: FlaskConical },
    { slug: "power-management", label: "Power Management", icon: SlidersVertical },
    { slug: "network", label: "Network", icon: Network },
    { slug: "time-and-weather", label: "Time & Weather", icon: Clock },
    { slug: "climate-effects", label: "Climate Change", icon: Leaf },
];

interface WikiSidebarProps {
    showBackToGame?: boolean;
}

export function WikiSidebar({ showBackToGame = false }: WikiSidebarProps) {
    const params = useParams({ strict: false });
    const currentSlug = params.slug;

    return (
        <Sidebar side="left" collapsible="offcanvas" className="overflow-hidden">
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {wikiLinks.map(({ slug, label, icon: Icon }) => (
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
                                            <span className="text-base">{label}</span>
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
                                    <span className="text-base">Back to Game</span>
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
