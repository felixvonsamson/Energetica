import { Link, useParams } from "@tanstack/react-router";
import {
    BatteryFull,
    BookOpen,
    Clock,
    FlaskConical,
    Gem,
    Hammer,
    Leaf,
    Map,
    Network,
    SlidersVertical,
    Warehouse,
    Zap,
} from "lucide-react";

import {
    Sidebar,
    SidebarContent,
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
    {
        slug: "storage-facilities",
        label: "Storage Facilities",
        icon: BatteryFull,
    },
    { slug: "resources", label: "Natural Resources", icon: Gem },
    {
        slug: "functional-facilities",
        label: "Functional Facilities",
        icon: Warehouse,
    },
    { slug: "technologies", label: "Technology", icon: FlaskConical },
    { slug: "power-management", label: "Power Management", icon: SlidersVertical },
    { slug: "network", label: "Network", icon: Network },
    { slug: "time-and-weather", label: "Time & Weather", icon: Clock },
    { slug: "climate-effects", label: "Climate Change", icon: Leaf },
];

export function WikiSidebarPublic() {
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
                                            to="/wiki/$slug"
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

            <SidebarRail />
        </Sidebar>
    );
}
