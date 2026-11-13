import { wikiNav } from "@energetica/content/wiki-nav";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@energetica/ui/components/sidebar";
import { Link, useParams } from "@tanstack/react-router";

export function WikiSidebarPublic() {
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
