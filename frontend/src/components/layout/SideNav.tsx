/** Mobile side navigation drawer that slides in from the right */

import { useEffect } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { X, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { navigationConfig, mobileOnlyNavigation } from "@/lib/nav-config";
import { Capabilities } from "@/types/players";

interface SideNavProps {
    isOpen: boolean;
    onClose: () => void;
    capabilities: Capabilities;
    openDropdown: string | null;
    onToggleDropdown: (dropdown: string) => void;
}

export function SideNav({
    isOpen,
    onClose,
    capabilities,
    openDropdown,
    onToggleDropdown,
}: SideNavProps) {
    // Handle body scroll lock when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    return (
        <>
            {/* Backdrop overlay */}
            <div
                className={`fixed inset-0 z-40 transition-opacity duration-300 ${
                    isOpen
                        ? "bg-black/50 opacity-100"
                        : "opacity-0 pointer-events-none"
                }`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Side drawer */}
            <div
                className={`fixed right-0 top-0 h-screen w-64 bg-tan-green dark:bg-dark-bg-secondary border-l border-pine-darker dark:border-dark-border z-50 overflow-y-auto transition-transform duration-300 ease-out ${
                    isOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                {/* Close button */}
                <div className="flex justify-end p-2 border-b border-pine-darker dark:border-dark-border">
                    <button
                        onClick={onClose}
                        className="text-pine dark:text-dark-text-primary p-2 hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary rounded transition-colors"
                        aria-label="Close navigation menu"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Navigation menu */}
                <ul className="py-2">
                    {navigationConfig.map((item) => {
                        const isVisible =
                            !item.visibility ||
                            item.visibility(
                                capabilities || {
                                    has_laboratory: false,
                                    has_warehouse: false,
                                    has_storage: false,
                                    has_network: false,
                                    has_greenhouse_gas_effect: false,
                                },
                            );

                        if (!isVisible) return null;

                        if (item.type === "link") {
                            return (
                                <NavItem
                                    key={`${item.to}`}
                                    to={item.to}
                                    icon={item.icon}
                                    onClose={onClose}
                                >
                                    {item.label}
                                </NavItem>
                            );
                        }

                        return (
                            <NavDropdown
                                key={`dropdown-${item.label}`}
                                label={item.label}
                                icon={item.icon}
                                isOpen={openDropdown === item.label}
                                onToggle={() => onToggleDropdown(item.label)}
                            >
                                {item.children.map((child) => {
                                    const childIsVisible =
                                        !child.visibility ||
                                        child.visibility(
                                            capabilities || {
                                                has_laboratory: false,
                                                has_warehouse: false,
                                                has_storage: false,
                                                has_network: false,
                                                has_greenhouse_gas_effect: false,
                                            },
                                        );

                                    if (!childIsVisible) return null;

                                    return (
                                        <NavItem
                                            key={`${child.to}`}
                                            to={child.to}
                                            icon={child.icon}
                                            onClose={onClose}
                                        >
                                            {child.label}
                                        </NavItem>
                                    );
                                })}
                            </NavDropdown>
                        );
                    })}

                    {/* Mobile-only navigation items */}
                    {mobileOnlyNavigation.map((item) => {
                        const isVisible =
                            !item.visibility ||
                            item.visibility(
                                capabilities || {
                                    has_laboratory: false,
                                    has_warehouse: false,
                                    has_storage: false,
                                    has_network: false,
                                    has_greenhouse_gas_effect: false,
                                },
                            );

                        if (!isVisible) return null;

                        if (item.type === "link") {
                            return (
                                <NavItem
                                    key={`${item.to}`}
                                    to={item.to}
                                    icon={item.icon}
                                    onClose={onClose}
                                >
                                    {item.label}
                                </NavItem>
                            );
                        }

                        return null;
                    })}
                </ul>
            </div>
        </>
    );
}

interface NavItemProps {
    to: LinkProps["to"];
    icon: LucideIcon;
    children: React.ReactNode;
    onClose: () => void;
}

function NavItem({ to, icon: Icon, children, onClose }: NavItemProps) {
    return (
        <li className="border-b border-pine/10 dark:border-dark-border/30">
            <Link
                to={to}
                onClick={onClose}
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

interface NavDropdownProps {
    label: string;
    icon: LucideIcon;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function NavDropdown({
    label,
    icon: Icon,
    isOpen,
    onToggle,
    children,
}: NavDropdownProps) {
    return (
        <li className="border-b border-pine/20 dark:border-dark-border/50">
            <button
                onClick={onToggle}
                className={
                    "flex items-center gap-2 px-4 py-3 text-pine dark:text-dark-text-primary hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors w-full"
                }
            >
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
            {isOpen && (
                <ul className="pl-8 bg-bone/50 dark:bg-dark-bg-secondary">
                    {children}
                </ul>
            )}
        </li>
    );
}
