import { Link, useLocation, type LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { useNavigation } from "@/contexts/navigation-context";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useChatList } from "@/hooks/useChats";
import { useRouteUnlocked } from "@/hooks/useRouteStaticData";
import { cn } from "@/lib/classname-utils";
import {
    mobileOnlyNavigation,
    navigationConfig,
    SHOW_LOCKED_ROUTES_AS_DISABLED,
} from "@/lib/nav-config";

/** Notification badge component for displaying unread message count. */
function NotificationBadge({ count }: { count: number }) {
    if (count === 0) return null;
    return (
        <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
            {count > 99 ? "99+" : count}
        </span>
    );
}

/**
 * Main navigation component that renders both desktop and mobile navigation.
 *
 * Desktop: Horizontal navigation bar (hidden on mobile) Mobile: Renders the
 * SideNav component (slide-in drawer from right)
 */
export function Navigation() {
    const location = useLocation();
    const capabilities = useCapabilities();
    const { data: chatListData } = useChatList();
    const { isMenuOpen, openDropdown, setOpenDropdown, toggleDropdown } =
        useNavigation();

    const unreadChatCount = chatListData?.unread_chat_count || 0;

    // Update dropdown state based on current route when mobile menu opens
    useEffect(() => {
        if (isMenuOpen) {
            const pathname = location.pathname;
            if (pathname.includes("/overviews")) {
                setOpenDropdown("Overviews");
            } else if (pathname.includes("/facilities")) {
                setOpenDropdown("Facilities");
            } else if (
                pathname.includes("/community") ||
                pathname.includes("/resource-market")
            ) {
                setOpenDropdown("Community");
            }
        }
    }, [isMenuOpen, location.pathname, setOpenDropdown]);

    if (!capabilities) return null;
    return (
        <>
            {/* Navigation Bar - Desktop only */}
            <nav className="hidden md:block bg-background border-b border-border">
                <div className="px-4">
                    {/* Navigation menu */}
                    <ul className="flex items-center gap-0 justify-center">
                        {navigationConfig.map((item) => {
                            if (item.type === "link") {
                                return (
                                    <NavLink
                                        key={`${item.to}`}
                                        to={item.to}
                                        params={item.params}
                                        icon={item.icon}
                                        variant="desktop"
                                    >
                                        {item.label}
                                    </NavLink>
                                );
                            } else {
                                return (
                                    <NavDropdown
                                        key={`dropdown-${item.label}`}
                                        label={item.label}
                                        icon={item.icon}
                                        isOpen={openDropdown === item.label}
                                        onToggle={() =>
                                            toggleDropdown(item.label)
                                        }
                                        variant="desktop"
                                        badgeCount={
                                            item.label === "Community"
                                                ? unreadChatCount
                                                : undefined
                                        }
                                    >
                                        {item.children.map((child) => {
                                            return (
                                                <NavLink
                                                    key={`${child.to}`}
                                                    to={child.to}
                                                    params={child.params}
                                                    icon={child.icon}
                                                    variant="desktop"
                                                    badgeCount={
                                                        child.label ===
                                                        "Messages"
                                                            ? unreadChatCount
                                                            : undefined
                                                    }
                                                >
                                                    {child.label}
                                                </NavLink>
                                            );
                                        })}
                                    </NavDropdown>
                                );
                            }
                        })}
                    </ul>
                </div>
            </nav>
            {/* Mobile Side Navigation */}
            <SideNav />
        </>
    );
}

/**
 * Mobile-only side navigation drawer that slides in from the right.
 *
 * Features:
 *
 * - Backdrop overlay when open
 * - Body scroll lock when open
 * - Close button in header
 * - Renders navigationConfig and mobileOnlyNavigation items
 * - Auto-closes on navigation
 */
export function SideNav() {
    const { isMenuOpen, setIsMenuOpen, openDropdown, toggleDropdown } =
        useNavigation();
    const { data: chatListData } = useChatList();

    const unreadChatCount = chatListData?.unread_chat_count || 0;

    // Handle body scroll lock when menu is open
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isMenuOpen]);

    return (
        <>
            {/* Backdrop overlay */}
            <div
                className={cn(
                    "fixed inset-0 z-40 transition-opacity duration-300",
                    isMenuOpen
                        ? "bg-black/50 opacity-100"
                        : "opacity-0 pointer-events-none",
                )}
                onClick={() => setIsMenuOpen(false)}
                aria-hidden="true"
            />

            {/* Side drawer */}
            <div
                className={cn(
                    "fixed right-0 top-0 h-screen w-64 bg-secondary border-l border-border z-50 overflow-y-auto transition-transform duration-300 ease-out",
                    isMenuOpen ? "translate-x-0" : "translate-x-full",
                )}
            >
                {/* Close button */}
                <div className="flex justify-end p-2 border-b border-border">
                    <button
                        onClick={() => setIsMenuOpen(false)}
                        className="text-foreground p-2 hover:bg-primary/30 rounded transition-colors"
                        aria-label="Close navigation menu"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Navigation menu */}
                <ul className="py-2">
                    {navigationConfig.map((item) => {
                        if (item.type === "link") {
                            return (
                                <NavLink
                                    key={`${item.to}`}
                                    to={item.to}
                                    params={item.params}
                                    icon={item.icon}
                                    onNavigate={() => setIsMenuOpen(false)}
                                    variant="mobile"
                                >
                                    {item.label}
                                </NavLink>
                            );
                        }

                        return (
                            <NavDropdown
                                key={`dropdown-${item.label}`}
                                label={item.label}
                                icon={item.icon}
                                isOpen={openDropdown === item.label}
                                onToggle={() => toggleDropdown(item.label)}
                                variant="mobile"
                                badgeCount={
                                    item.label === "Community"
                                        ? unreadChatCount
                                        : undefined
                                }
                            >
                                {item.children.map((child) => {
                                    return (
                                        <NavLink
                                            key={`${child.to}`}
                                            to={child.to}
                                            params={child.params}
                                            icon={child.icon}
                                            onNavigate={() =>
                                                setIsMenuOpen(false)
                                            }
                                            isInsideDropdown
                                            variant="mobile"
                                            badgeCount={
                                                child.label === "Messages"
                                                    ? unreadChatCount
                                                    : undefined
                                            }
                                        >
                                            {child.label}
                                        </NavLink>
                                    );
                                })}
                            </NavDropdown>
                        );
                    })}

                    {/* Mobile-only navigation items */}
                    {mobileOnlyNavigation.map((item) => {
                        // Mobile-only nav only contains links
                        if (item.type !== "link") return null;

                        return (
                            <NavLink
                                key={`${item.to}`}
                                to={item.to}
                                params={item.params}
                                icon={item.icon}
                                onNavigate={() => setIsMenuOpen(false)}
                                variant="mobile"
                            >
                                {item.label}
                            </NavLink>
                        );
                    })}
                </ul>
            </div>
        </>
    );
}

interface NavDropdownProps {
    label: string;
    icon: LucideIcon;
    isOpen: boolean;
    onToggle: () => void;
    children: ReactNode;
    variant?: "desktop" | "mobile";
    badgeCount?: number;
}

/**
 * Dropdown navigation menu used in both desktop and mobile navigation.
 *
 * Behavior varies by variant:
 *
 * - Desktop: Absolute positioned dropdown with shadow and border
 * - Mobile: Inline expansion with indented children
 *
 * @param variant - "desktop" (default) for horizontal nav bar, "mobile" for
 *   side drawer
 */
function NavDropdown({
    label,
    icon: Icon,
    isOpen,
    onToggle,
    children,
    variant = "desktop",
    badgeCount,
}: NavDropdownProps) {
    const isDesktop = variant === "desktop";

    return (
        <li
            className={cn(
                "border-b border-border/50",
                isDesktop && "w-full md:w-auto md:relative md:border-none z-10",
            )}
        >
            <button
                onClick={onToggle}
                className="flex items-center gap-2 px-4 py-3 w-full transition-colors text-foreground hover:bg-primary/30"
            >
                <Icon size={20} />
                <span className="font-medium">{label}</span>
                {badgeCount !== undefined && badgeCount > 0 && (
                    <NotificationBadge count={badgeCount} />
                )}
                <ChevronDown
                    size={16}
                    className={cn(
                        "ml-auto transition-transform",
                        isOpen && "rotate-180",
                    )}
                />
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <ul
                    className={cn(
                        "bg-muted",
                        isDesktop &&
                            "md:absolute md:left-0 md:top-full md:bg-card md:shadow-lg md:min-w-55 md:border-2 md:border-border",
                        !isDesktop && "bg-card",
                    )}
                >
                    {children}
                </ul>
            )}
        </li>
    );
}

interface NavLinkProps {
    to: LinkProps["to"];
    params?: LinkProps["params"];
    icon: LucideIcon;
    children: ReactNode;
    onNavigate?: () => void;
    variant?: "desktop" | "mobile";
    isInsideDropdown?: boolean;
    badgeCount?: number;
}

/**
 * Navigation link component used in both desktop and mobile navigation.
 *
 * Features:
 *
 * - Automatically checks if route is unlocked based on player capabilities
 * - Can render as disabled or hidden when locked (based on
 *   SHOW_LOCKED_ROUTES_AS_DISABLED)
 * - Active state styling
 * - Optional onNavigate callback (used by mobile to close drawer)
 *
 * @param onNavigate - Callback fired when link is clicked (typically used to
 *   close mobile menu)
 * @param variant - "desktop" (default) for horizontal nav bar, "mobile" for
 *   side drawer
 */
function NavLink({
    to,
    params,
    icon: Icon,
    children,
    onNavigate,
    variant = "desktop",
    isInsideDropdown = false,
    badgeCount,
}: NavLinkProps) {
    const capabilities = useCapabilities();
    const isDesktop = variant === "desktop";

    // Call hook unconditionally, pass null capabilities if not available
    const isUnlocked = useRouteUnlocked(to, capabilities || null);

    // If not using disabled mode, hide locked items
    if (!SHOW_LOCKED_ROUTES_AS_DISABLED && !isUnlocked) {
        return null;
    }

    const disabled = SHOW_LOCKED_ROUTES_AS_DISABLED && !isUnlocked;

    return (
        <li
            className={cn(
                "border-b border-border/30",
                isDesktop && "w-full md:w-auto md:border-none",
            )}
        >
            {disabled ? (
                <div
                    className={cn(
                        "flex items-center gap-2 px-4 py-3 text-foreground/50 opacity-50",
                        isInsideDropdown ? "pl-8" : "",
                    )}
                >
                    <Icon size={20} />
                    <span>{children}</span>
                    {badgeCount !== undefined && badgeCount > 0 && (
                        <NotificationBadge count={badgeCount} />
                    )}
                </div>
            ) : (
                <Link
                    to={to}
                    params={params}
                    onClick={onNavigate}
                    className={cn(
                        "flex items-center gap-2 px-4 py-3 text-foreground hover:bg-primary/30 transition-colors",
                        isInsideDropdown ? "pl-8" : "",
                    )}
                    activeProps={{
                        className: "bg-primary/30 font-semibold",
                    }}
                >
                    <Icon size={20} />
                    <span>{children}</span>
                    {badgeCount !== undefined && badgeCount > 0 && (
                        <NotificationBadge count={badgeCount} />
                    )}
                </Link>
            )}
        </li>
    );
}
