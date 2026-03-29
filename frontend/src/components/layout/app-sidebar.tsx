/**
 * Main application sidebar using shadcn's Sidebar components. Contains logo,
 * navigation groups, and footer links.
 */

import { Link, useLocation, type LinkProps } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import Logo from "@/assets/icon.svg?react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarFooter,
    SidebarRail,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarMenuSub,
    SidebarMenuBadge,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useUnreadChatsCount } from "@/hooks/use-chats";
import { useRouteUnlocked } from "@/hooks/use-route-static-data";
import { useSidebarMenuState } from "@/hooks/use-sidebar-menu-state";
import {
    navConfigFooter,
    navConfig,
    type NavGroupConfig,
    type NavLinkConfig,
} from "@/lib/nav-config";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
    scrollPosition?: number;
}

export function AppSidebar({ scrollPosition = 0 }: AppSidebarProps) {
    // Calculate rotation based on scroll position (1 full rotation every 1000px)
    const rotation = -(scrollPosition / 10000) * 360;

    return (
        <Sidebar
            side="left"
            collapsible="offcanvas"
            className="overflow-hidden"
        >
            {/* Large background logo */}
            <div
                className="pointer-events-none absolute left-0 top-1/2 z-0 -translate-x-[55%] -translate-y-1/2 opacity-[0.3]  duration-50"
                style={{
                    transform: `rotate(${rotation}deg)`,
                }}
            >
                <Logo className="size-200 fill-bone" />
            </div>

            <SidebarContent className="relative z-10">
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navConfig.map((item) => {
                                if (item.type === "link") {
                                    return (
                                        <NavLinkItem
                                            key={item.label}
                                            item={item}
                                        />
                                    );
                                }

                                return (
                                    <NavGroupItem
                                        key={item.label}
                                        item={item}
                                    />
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="relative z-10">
                <SidebarMenu>
                    {navConfigFooter.map((item) => {
                        if (item.type !== "link") return null;
                        return <NavLinkItem key={item.label} item={item} />;
                    })}
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}

function NavGroupItem({ item }: { item: NavGroupConfig }) {
    const location = useLocation();
    const Icon = item.icon;

    // Check if any child route is currently active
    const isGroupActive = item.children.some((child) => {
        const childPath =
            typeof child.to === "string" ? child.to : String(child.to);
        return location.pathname.startsWith(childPath);
    });

    // Use persistent state for menu open/closed
    const [isOpen, setIsOpen] = useSidebarMenuState(item.label, isGroupActive);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="group/collapsible"
        >
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        tooltip={item.label}
                    >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                        {item.label === "Community" && (
                            <UnreadChatsBadge className="right-7" />
                        )}
                        <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
                <SidebarMenuSub>
                    {item.children.map((child) => (
                        <NavSubLinkItem key={child.label} item={child} />
                    ))}
                </SidebarMenuSub>
            </CollapsibleContent>
        </Collapsible>
    );
}

function NavLinkItem({ item }: { item: NavLinkConfig }) {
    const capabilities = useCapabilities();
    const location = useLocation();
    const Icon = item.icon;
    const status = useRouteUnlocked(item.to, capabilities);

    const disabled = !status.unlocked;
    const itemPath = typeof item.to === "string" ? item.to : String(item.to);
    const isActive = location.pathname === itemPath;

    const button = (
        <SidebarMenuButton
            asChild
            isActive={isActive}
            disabled={disabled}
            tooltip={item.label}
        >
            <Link to={item.to} params={item.params as LinkProps["params"]}>
                <Icon className="size-4" />
                <span>{item.label}</span>
            </Link>
        </SidebarMenuButton>
    );

    return (
        <SidebarMenuItem>
            {disabled ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span>{button}</span>
                    </TooltipTrigger>
                    <TooltipContent side="right">{status.reason}</TooltipContent>
                </Tooltip>
            ) : (
                button
            )}
            {item.to === "/app/community/messages" && <UnreadChatsBadge />}
        </SidebarMenuItem>
    );
}

function NavSubLinkItem({ item }: { item: NavLinkConfig }) {
    const capabilities = useCapabilities();
    const location = useLocation();
    const Icon = item.icon;
    const status = useRouteUnlocked(item.to, capabilities);

    const disabled = !status.unlocked;
    const itemPath = typeof item.to === "string" ? item.to : String(item.to);
    const isActive = location.pathname === itemPath;

    const button = (
        <SidebarMenuSubButton
            asChild
            isActive={isActive}
            className={cn(disabled && "pointer-events-none opacity-50")}
        >
            <Link to={item.to} params={item.params as LinkProps["params"]}>
                <Icon className="size-4" />
                <span>{item.label}</span>
                {item.to === "/app/community/messages" && <UnreadChatsBadge />}
            </Link>
        </SidebarMenuSubButton>
    );

    return (
        <SidebarMenuSubItem>
            {disabled ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span>{button}</span>
                    </TooltipTrigger>
                    <TooltipContent side="right">{status.reason}</TooltipContent>
                </Tooltip>
            ) : (
                button
            )}
        </SidebarMenuSubItem>
    );
}

function UnreadChatsBadge({ className = "" }: { className?: string }) {
    const unreadChatsCount = useUnreadChatsCount();

    return (
        <>
            {unreadChatsCount !== undefined && unreadChatsCount > 0 && (
                <SidebarMenuBadge
                    className={cn(
                        "bg-destructive text-destructive-foreground",
                        className,
                    )}
                >
                    {unreadChatsCount > 99 ? "99+" : unreadChatsCount}
                </SidebarMenuBadge>
            )}
        </>
    );
}
