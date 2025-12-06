/**
 * Top bar component showing logo, money, resources, workers, user actions, and
 * navigation.
 */

import { useState, useEffect } from "react";
import { Link, type LinkProps, useLocation } from "@tanstack/react-router";
import {
    Menu,
    ChevronDown,
    Settings,
    Bell,
    AlertCircle,
    Hammer,
    FlaskConical,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePlayerMoney } from "@/hooks/usePlayerMoney";
import { usePlayerWorkers } from "@/hooks/usePlayerWorkers";
import { usePlayerResources } from "@/hooks/usePlayerResources";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useCapabilities } from "@/hooks/useCapabilities";
import { NotificationPopup } from "./NotificationPopup";
import { SideNav } from "./SideNav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Money } from "@/types/money";
import { Workers } from "@/types/workers";
import { Resources } from "@/types/resources";
import type { LucideIcon } from "lucide-react";
import { navigationConfig } from "@/lib/nav-config";

export function TopBar() {
    const { user } = useAuth();
    const capabilities = useCapabilities();
    const location = useLocation();
    const {
        data: moneyData,
        isLoading: isMoneyLoading,
        isError: isMoneyError,
        error: moneyError,
    } = usePlayerMoney();
    const {
        data: workersData,
        isLoading: isWorkersLoading,
        isError: isWorkersError,
    } = usePlayerWorkers();
    const {
        data: resourcesData,
        isLoading: isResourcesLoading,
        isError: isResourcesError,
    } = usePlayerResources();
    const { isConnected } = useOnlineStatus();
    const [showNotifications, setShowNotifications] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

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
    }, [isMenuOpen, location.pathname]);

    const toggleDropdown = (dropdown: string) => {
        setOpenDropdown(openDropdown === dropdown ? null : dropdown);
    };

    if (!user) return null;
    if (!capabilities) return null;

    return (
        <>
            <div className="bg-game-bg border-b border-pine-darker px-4 py-1">
                <div className="flex items-center justify-between gap-4">
                    {/* Logo */}
                    {Logo()}

                    {/* Resources and Actions */}
                    <div className="flex items-center gap-4">
                        {/* Money and Resources */}
                        <div className="bg-content-bg text-primary rounded px-3 py-0 md:px-4">
                            <div className="flex gap-3 md:gap-3 items-center">
                                {/* Money */}
                                {MoneyDisplay(
                                    isMoneyLoading,
                                    moneyData,
                                    isMoneyError,
                                    isConnected,
                                    moneyError,
                                )}

                                {/* Resource Gauges - only show if warehouse unlocked */}
                                {capabilities?.has_warehouse &&
                                    ResourceGauges(
                                        isResourcesError,
                                        isResourcesLoading,
                                        resourcesData,
                                    )}

                                {/* Workers */}
                                {WorkersDisplay(
                                    isWorkersError,
                                    isWorkersLoading,
                                    workersData,
                                    capabilities,
                                )}
                            </div>
                        </div>

                        {/* Settings, Notifications, Theme Toggle, and Mobile Menu */}
                        <div className="flex gap-2">
                            <a
                                href="/settings"
                                className="bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary px-2 py-2 lg:px-4 rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors flex items-center justify-center aspect-square h-9"
                            >
                                <Settings size={20} />
                                <span className="ml-2 hidden lg:inline">
                                    Settings
                                </span>
                            </a>

                            <button
                                onClick={() => setShowNotifications(true)}
                                className="bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary px-2 py-2 lg:px-4 rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors relative flex items-center justify-center aspect-square h-9"
                            >
                                <Bell size={20} />
                                <span className="ml-2 hidden lg:inline">
                                    Notifications
                                </span>
                                {/* Unread badge - TODO: Show actual count */}
                                {0 > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-pine dark:bg-brand-green text-pine-text text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                        {0}
                                    </span>
                                )}
                            </button>

                            {/* Theme toggle */}
                            <ThemeToggle className="px-2 py-2 bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors h-9" />

                            {/* Mobile menu button */}
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="md:hidden bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary px-2 py-2 rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors flex items-center justify-center aspect-square h-9"
                                aria-label="Toggle navigation menu"
                            >
                                <Menu size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Bar - Desktop only */}
            <nav className="hidden md:block bg-tan-green dark:bg-dark-bg-secondary border-b border-pine-darker dark:border-dark-border">
                <div className="px-4">
                    {/* Navigation menu */}
                    <ul className="flex items-center gap-0 justify-center">
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
                                    onToggle={() => toggleDropdown(item.label)}
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
                                            >
                                                {child.label}
                                            </NavItem>
                                        );
                                    })}
                                </NavDropdown>
                            );
                        })}
                    </ul>
                </div>
            </nav>

            {/* Mobile Side Navigation */}
            <SideNav
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                capabilities={capabilities}
                openDropdown={openDropdown}
                onToggleDropdown={toggleDropdown}
            />

            {/* Notification Popup Modal */}
            <NotificationPopup
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
            />
        </>
    );
}

function WorkersDisplay(
    isWorkersError: boolean,
    isWorkersLoading: boolean,
    workersData: Workers | undefined,
    capabilities: {
        has_laboratory: boolean;
        has_warehouse: boolean;
        has_storage: boolean;
        has_network: boolean;
        has_greenhouse_gas_effect: boolean;
    } | null,
) {
    return (
        <div className="flex flex-col text-sm justify-around">
            {/* Construction Workers */}
            <div className="flex items-center gap-1 relative group">
                <span className={isWorkersError ? "opacity-75" : ""}>
                    {isWorkersLoading && !workersData
                        ? "..."
                        : `${workersData?.construction.available ?? 0}/${workersData?.construction.total ?? 0}`}
                </span>
                <Hammer size={16} />
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Construction workers
                </div>
            </div>

            {/* Lab Workers - only show if laboratory unlocked */}
            {capabilities?.has_laboratory && (
                <div className="flex items-center gap-1 relative group">
                    <span className={isWorkersError ? "opacity-75" : ""}>
                        {isWorkersLoading && !workersData
                            ? "..."
                            : `${workersData?.laboratory.available ?? 0}/${workersData?.laboratory.total ?? 0}`}
                    </span>
                    <FlaskConical size={16} />
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Lab workers
                    </div>
                </div>
            )}
        </div>
    );
}

function ResourceGauges(
    isResourcesError: boolean,
    isResourcesLoading: boolean,
    resourcesData: Resources | undefined,
) {
    return (
        <div className="flex flex-col gap-1">
            {/* Coal */}
            <div className="relative group">
                <div className="w-16 h-3 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${isResourcesError ? "opacity-75" : ""}`}
                        style={{
                            width: isResourcesLoading
                                ? "0%"
                                : `${Math.min(
                                      100,
                                      ((resourcesData?.coal.stock ?? 0) /
                                          (resourcesData?.coal.capacity || 1)) *
                                          100,
                                  )}%`,
                            backgroundColor: "var(--asset-color-coal)",
                        }}
                    ></div>
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    Coal stock:{" "}
                    {isResourcesLoading
                        ? "..."
                        : `${(resourcesData?.coal.stock ?? 0).toFixed(0)}kg / ${(resourcesData?.coal.capacity ?? 0).toFixed(0)}kg`}
                </div>
            </div>

            {/* Gas */}
            <div className="relative group">
                <div className="w-16 h-3 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${isResourcesError ? "opacity-75" : ""}`}
                        style={{
                            width: isResourcesLoading
                                ? "0%"
                                : `${Math.min(
                                      100,
                                      ((resourcesData?.gas.stock ?? 0) /
                                          (resourcesData?.gas.capacity || 1)) *
                                          100,
                                  )}%`,
                            backgroundColor: "var(--asset-color-gas)",
                        }}
                    ></div>
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    Gas stock:{" "}
                    {isResourcesLoading
                        ? "..."
                        : `${(resourcesData?.gas.stock ?? 0).toFixed(0)}kg / ${(resourcesData?.gas.capacity ?? 0).toFixed(0)}kg`}
                </div>
            </div>

            {/* Uranium */}
            <div className="relative group">
                <div className="w-16 h-3 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${isResourcesError ? "opacity-75" : ""}`}
                        style={{
                            width: isResourcesLoading
                                ? "0%"
                                : `${Math.min(
                                      100,
                                      ((resourcesData?.uranium.stock ?? 0) /
                                          (resourcesData?.uranium.capacity ||
                                              1)) *
                                          100,
                                  )}%`,
                            backgroundColor: "var(--asset-color-uranium)",
                        }}
                    ></div>
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    Uranium stock:{" "}
                    {isResourcesLoading
                        ? "..."
                        : `${(resourcesData?.uranium.stock ?? 0).toFixed(0)}kg / ${(resourcesData?.uranium.capacity ?? 0).toFixed(0)}kg`}
                </div>
            </div>
        </div>
    );
}

function MoneyDisplay(
    isMoneyLoading: boolean,
    moneyData: undefined | Money,
    isMoneyError: boolean,
    isConnected: boolean,
    moneyError: Error | null,
) {
    return (
        <div className="text-base md:text-xl lg:text-2xl font-bold relative whitespace-nowrap">
            {isMoneyLoading && !moneyData ? (
                <span className="text-gray-500">Loading...</span>
            ) : (
                <>
                    {/* Show offline indicator if error */}
                    {isMoneyError && !isConnected && (
                        <span
                            className="absolute -top-1 -right-1 text-xs text-red-600"
                            title={moneyError?.message || "Connection lost"}
                        >
                            <AlertCircle size={16} />
                        </span>
                    )}
                    {/* Show stale data even if error */}
                    <span className={isMoneyError ? "opacity-75" : ""}>
                        $
                        {(moneyData?.money ?? 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </span>
                </>
            )}
        </div>
    );
}

function Logo() {
    return (
        <div className="flex items-center gap-2">
            <img
                src="/static/images/icon.svg"
                alt="Energetica"
                className="w-8 h-8 brightness-0 saturate-100 hue-rotate-90 opacity-70 dark:invert dark:brightness-100 dark:saturate-100 dark:hue-rotate-0 dark:opacity-100"
                style={{
                    filter: "brightness(0) saturate(100%) invert(18%) sepia(18%) saturate(2873%) hue-rotate(88deg) brightness(95%) contrast(88%)",
                }}
            />
            <span className="text-xl font-bold text-primary">Energetica</span>
        </div>
    );
}

interface NavItemProps {
    to: LinkProps["to"];
    icon: LucideIcon;
    children: React.ReactNode;
}

function NavItem({ to, icon: Icon, children }: NavItemProps) {
    return (
        <li className="w-full md:w-auto border-b border-pine/10 dark:border-dark-border/30 md:border-none">
            <Link
                to={to}
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
        <li className="w-full md:w-auto md:relative border-b border-pine/20 dark:border-dark-border/50 md:border-none">
            <button
                onClick={onToggle}
                className={`flex items-center gap-2 px-4 py-3 text-pine dark:text-dark-text-primary hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors w-full ${
                    isOpen ? "bg-tan-hover dark:bg-dark-bg-tertiary" : ""
                }`}
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
                <ul className="bg-bone/50 dark:bg-dark-bg-tertiary md:absolute md:left-0 md:top-full md:bg-bone dark:md:bg-dark-bg-secondary md:shadow-lg md:min-w-[220px] md:border-2 md:border-pine-darker dark:md:border-dark-border">
                    {children}
                </ul>
            )}
        </li>
    );
}
