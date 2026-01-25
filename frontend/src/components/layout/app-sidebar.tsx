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
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
} from "@/components/ui/sidebar";
import { TypographyBrand, TypographyH2 } from "@/components/ui/typography";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useChatList } from "@/hooks/useChats";
import { useRouteUnlocked } from "@/hooks/useRouteStaticData";
import { useSidebarMenuState } from "@/hooks/useSidebarMenuState";
import {
    mobileOnlyNavigation,
    navigationConfig,
    SHOW_LOCKED_ROUTES_AS_DISABLED,
    type NavGroupConfig,
    type NavLinkConfig,
    type Capabilities,
} from "@/lib/nav-config";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
    scrollPosition?: number;
}

export function AppSidebar({ scrollPosition = 0 }: AppSidebarProps) {
    const capabilities = useCapabilities();
    const { data: chatListData } = useChatList();
    const unreadChatCount = chatListData?.unread_chat_count || 0;

    if (!capabilities) return null;

    // Calculate rotation based on scroll position (1 full rotation every 1000px)
    const rotation = -(scrollPosition / 10000) * 360;

    return (
        <Sidebar
            side="left"
            collapsible="offcanvas"
            className="relative overflow-hidden"
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

            <SidebarHeader className="relative z-10 flex-row items-center justify-center">
                <div className="flex aspect-square size-12 items-center justify-center">
                    <Logo className="size-20 fill-sidebar-foreground" />
                </div>
                <TypographyH2>
                    <TypographyBrand>Energetica</TypographyBrand>
                </TypographyH2>
            </SidebarHeader>

            <SidebarContent className="relative z-10">
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navigationConfig.map((item) => {
                                if (item.type === "link") {
                                    return (
                                        <NavLinkItem
                                            key={item.label}
                                            item={item}
                                            capabilities={capabilities}
                                        />
                                    );
                                }

                                return (
                                    <NavGroupItem
                                        key={item.label}
                                        item={item}
                                        capabilities={capabilities}
                                        unreadChatCount={unreadChatCount}
                                    />
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="relative z-10">
                <SidebarMenu>
                    {mobileOnlyNavigation.map((item) => {
                        if (item.type !== "link") return null;
                        return (
                            <NavLinkItem
                                key={item.label}
                                item={item}
                                capabilities={capabilities}
                            />
                        );
                    })}
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}

interface NavGroupItemProps {
    item: NavGroupConfig;
    capabilities: Capabilities;
    unreadChatCount: number;
}

function NavGroupItem({
    item,
    capabilities,
    unreadChatCount,
}: NavGroupItemProps) {
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

    // Calculate badge count for group (e.g., Community group shows unread messages)
    const groupBadgeCount = item.label === "Community" ? unreadChatCount : 0;

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
                        {groupBadgeCount > 0 && (
                            <span className="ml-auto mr-2 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                                {groupBadgeCount > 99 ? "99+" : groupBadgeCount}
                            </span>
                        )}
                        <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
                <SidebarMenuSub>
                    {item.children.map((child) => (
                        <NavSubLinkItem
                            key={child.label}
                            item={child}
                            capabilities={capabilities}
                            showBadge={child.label === "Messages"}
                            badgeCount={
                                child.label === "Messages" ? unreadChatCount : 0
                            }
                        />
                    ))}
                </SidebarMenuSub>
            </CollapsibleContent>
        </Collapsible>
    );
}

interface NavLinkItemProps {
    item: NavLinkConfig;
    capabilities: Capabilities;
    badgeCount?: number;
}

function NavLinkItem({ item, capabilities, badgeCount }: NavLinkItemProps) {
    const location = useLocation();
    const Icon = item.icon;
    const isUnlocked = useRouteUnlocked(item.to, capabilities);

    // If not using disabled mode, hide locked items
    if (!SHOW_LOCKED_ROUTES_AS_DISABLED && !isUnlocked) {
        return null;
    }

    const disabled = SHOW_LOCKED_ROUTES_AS_DISABLED && !isUnlocked;
    const itemPath = typeof item.to === "string" ? item.to : String(item.to);
    const isActive = location.pathname === itemPath;

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild={!disabled}
                isActive={isActive}
                disabled={disabled}
                tooltip={item.label}
            >
                {disabled ? (
                    <div className="flex items-center gap-2 opacity-50">
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                    </div>
                ) : (
                    <Link
                        to={item.to}
                        params={item.params as LinkProps["params"]}
                    >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                    </Link>
                )}
            </SidebarMenuButton>
            {badgeCount !== undefined && badgeCount > 0 && (
                <SidebarMenuBadge className="bg-destructive text-destructive-foreground">
                    {badgeCount > 99 ? "99+" : badgeCount}
                </SidebarMenuBadge>
            )}
        </SidebarMenuItem>
    );
}

interface NavSubLinkItemProps {
    item: NavLinkConfig;
    capabilities: Capabilities;
    showBadge?: boolean;
    badgeCount?: number;
}

function NavSubLinkItem({
    item,
    capabilities,
    showBadge,
    badgeCount,
}: NavSubLinkItemProps) {
    const location = useLocation();
    const Icon = item.icon;
    const isUnlocked = useRouteUnlocked(item.to, capabilities);

    // If not using disabled mode, hide locked items
    if (!SHOW_LOCKED_ROUTES_AS_DISABLED && !isUnlocked) {
        return null;
    }

    const disabled = SHOW_LOCKED_ROUTES_AS_DISABLED && !isUnlocked;
    const itemPath = typeof item.to === "string" ? item.to : String(item.to);
    const isActive = location.pathname === itemPath;

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton
                asChild={!disabled}
                isActive={isActive}
                className={cn(disabled && "pointer-events-none opacity-50")}
            >
                {disabled ? (
                    <div className="flex items-center gap-2">
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                        {showBadge &&
                            badgeCount !== undefined &&
                            badgeCount > 0 && (
                                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                                    {badgeCount > 99 ? "99+" : badgeCount}
                                </span>
                            )}
                    </div>
                ) : (
                    <Link
                        to={item.to}
                        params={item.params as LinkProps["params"]}
                    >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                        {showBadge &&
                            badgeCount !== undefined &&
                            badgeCount > 0 && (
                                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                                    {badgeCount > 99 ? "99+" : badgeCount}
                                </span>
                            )}
                    </Link>
                )}
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    );
}
