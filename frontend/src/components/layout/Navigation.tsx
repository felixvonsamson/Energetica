import { Link, useLocation, type LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { useNavigation } from "@/contexts/NavigationContext";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useRouteUnlocked } from "@/hooks/useRouteStaticData";
import {
    mobileOnlyNavigation,
    navigationConfig,
    SHOW_LOCKED_ROUTES_AS_DISABLED,
} from "@/lib/nav-config";

export function Navigation() {
    const location = useLocation();
    const capabilities = useCapabilities();
    const { isMenuOpen, openDropdown, setOpenDropdown, toggleDropdown } =
        useNavigation();

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
            <nav className="hidden md:block bg-tan-green dark:bg-dark-bg-secondary border-b border-pine-darker dark:border-dark-border">
                <div className="px-4">
                    {/* Navigation menu */}
                    <ul className="flex items-center gap-0 justify-center">
                        {navigationConfig.map((item) => {
                            if (item.type === "link") {
                                return (
                                    <NavLink
                                        key={`${item.to}`}
                                        to={item.to}
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
                                    >
                                        {item.children.map((child) => {
                                            return (
                                                <NavLink
                                                    key={`${child.to}`}
                                                    to={child.to}
                                                    icon={child.icon}
                                                    variant="desktop"
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

/** Mobile side navigation drawer that slides in from the right */

export function SideNav() {
    const { isMenuOpen, setIsMenuOpen, openDropdown, toggleDropdown } =
        useNavigation();

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
                className={`fixed inset-0 z-40 transition-opacity duration-300 ${
                    isMenuOpen
                        ? "bg-black/50 opacity-100"
                        : "opacity-0 pointer-events-none"
                }`}
                onClick={() => setIsMenuOpen(false)}
                aria-hidden="true"
            />

            {/* Side drawer */}
            <div
                className={`fixed right-0 top-0 h-screen w-64 bg-tan-green dark:bg-dark-bg-secondary border-l border-pine-darker dark:border-dark-border z-50 overflow-y-auto transition-transform duration-300 ease-out ${
                    isMenuOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                {/* Close button */}
                <div className="flex justify-end p-2 border-b border-pine-darker dark:border-dark-border">
                    <button
                        onClick={() => setIsMenuOpen(false)}
                        className="text-pine dark:text-dark-text-primary p-2 hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary rounded transition-colors"
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
                            >
                                {item.children.map((child) => {
                                    return (
                                        <NavLink
                                            key={`${child.to}`}
                                            to={child.to}
                                            icon={child.icon}
                                            onNavigate={() =>
                                                setIsMenuOpen(false)
                                            }
                                            variant="mobile"
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
}

function NavDropdown({
    label,
    icon: Icon,
    isOpen,
    onToggle,
    children,
    variant = "desktop",
}: NavDropdownProps) {
    const isDesktop = variant === "desktop";

    const buttonClass =
        "flex items-center gap-2 px-4 py-3 w-full transition-colors text-pine dark:text-dark-text-primary hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary";

    const dropdownClass = isDesktop
        ? "bg-bone/50 dark:bg-dark-bg-tertiary md:absolute md:left-0 md:top-full md:bg-bone dark:md:bg-dark-bg-secondary md:shadow-lg md:min-w-[220px] md:border-2 md:border-pine-darker dark:md:border-dark-border"
        : "pl-8 bg-bone/50 dark:bg-dark-bg-secondary";

    const liClass = isDesktop
        ? "w-full md:w-auto md:relative border-b border-pine/20 dark:border-dark-border/50 md:border-none"
        : "border-b border-pine/20 dark:border-dark-border/50";

    return (
        <li className={liClass}>
            <button onClick={onToggle} className={buttonClass}>
                <Icon size={20} />
                <span className="font-medium">{label}</span>
                <ChevronDown
                    size={16}
                    className={`ml-auto transition-transform ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </button>

            {/* Dropdown menu */}
            {isOpen && <ul className={dropdownClass}>{children}</ul>}
        </li>
    );
}

interface NavLinkProps {
    to: LinkProps["to"];
    icon: LucideIcon;
    children: ReactNode;
    onNavigate?: () => void;
    variant?: "desktop" | "mobile";
}

function NavLink({
    to,
    icon: Icon,
    children,
    onNavigate,
    variant = "desktop",
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
    const liClass = isDesktop
        ? "w-full md:w-auto border-b border-pine/10 dark:border-dark-border/30 md:border-none"
        : "border-b border-pine/10 dark:border-dark-border/30";

    if (disabled) {
        return (
            <li className={liClass}>
                <div className="flex items-center gap-2 px-4 py-3 text-pine/50 dark:text-dark-text-primary/50 opacity-50">
                    <Icon size={20} />
                    <span>{children}</span>
                </div>
            </li>
        );
    }

    return (
        <li className={liClass}>
            <Link
                to={to}
                onClick={onNavigate}
                className="flex items-center gap-2 px-4 py-3 text-pine dark:text-dark-text-primary hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors"
                activeProps={{
                    className:
                        "bg-tan-hover dark:bg-dark-bg-tertiary font-semibold",
                }}
            >
                <Icon size={20} />
                <span>{children}</span>
            </Link>
        </li>
    );
}
