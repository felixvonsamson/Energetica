/**
 * Top bar component showing logo, money, resources, workers, user actions, and
 * navigation.
 */

import { useState } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { Menu, ChevronDown } from "lucide-react";
import { useAuth } from "@hooks/useAuth";
import { usePlayerMoney } from "@hooks/usePlayerMoney";
import { usePlayerWorkers } from "@hooks/usePlayerWorkers";
import { usePlayerResources } from "@hooks/usePlayerResources";
import { useOnlineStatus } from "@hooks/useOnlineStatus";
import { useCapabilities } from "@hooks/useCapabilities";
import { NotificationPopup } from "./NotificationPopup";
import { ThemeToggle } from "@components/ui/ThemeToggle";
import { Money } from "@app-types/money";
import { Workers } from "@/types/workers";
import { Resources } from "@/types/resources";

export function TopBar() {
    const { user } = useAuth();
    const capabilities = useCapabilities();
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

    // Get capability flags
    const hasWarehouse = capabilities?.has_warehouse ?? false;
    const hasNetwork = capabilities?.has_network ?? false;
    const hasLaboratory = capabilities?.has_laboratory ?? false;
    const hasStorageFacilities = capabilities?.has_storage ?? false;

    // TODO: Get from capabilities when available
    const discoveredGreenhouse = false;

    const toggleDropdown = (dropdown: string) => {
        setOpenDropdown(openDropdown === dropdown ? null : dropdown);
    };

    if (!user) return null;

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

                        {/* Settings, Notifications and Theme Toggle */}
                        <div className="flex gap-2">
                            <a
                                href="/settings"
                                className="bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary px-2 py-2 lg:px-4 rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors flex items-center justify-center aspect-square h-9"
                            >
                                <i className="fa fa-cog"></i>
                                <span className="ml-2 hidden lg:inline">
                                    Settings
                                </span>
                            </a>

                            <button
                                onClick={() => setShowNotifications(true)}
                                className="bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary px-2 py-2 lg:px-4 rounded hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors relative flex items-center justify-center aspect-square h-9"
                            >
                                <i className="fa fa-bell"></i>
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
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Bar */}
            <nav className="bg-tan-green dark:bg-dark-bg-secondary border-b-2 border-pine-darker dark:border-dark-border">
                <div className="px-4">
                    {/* Mobile menu button */}
                    <div className="flex items-center justify-between md:hidden py-3">
                        <div className="flex items-center gap-2">
                            <span className="text-pine dark:text-dark-text-primary font-bold">
                                Menu
                            </span>
                        </div>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="text-pine dark:text-dark-text-primary p-2 hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary rounded transition-colors"
                            aria-label="Toggle navigation menu"
                        >
                            <Menu size={24} />
                        </button>
                    </div>

                    {/* Navigation menu */}
                    <ul
                        className={`${
                            isMenuOpen ? "block" : "hidden"
                        } md:flex md:items-center md:gap-0`}
                    >
                        {/* Dashboard */}
                        <NavItem to="/app/dashboard" icon="dashboard.png">
                            Dashboard
                        </NavItem>

                        {/* Profile */}
                        <NavItem to="/app/profile" icon="profile.png">
                            Profile
                        </NavItem>

                        {/* Production Overview Dropdown */}
                        <NavDropdown
                            label="Production Overview"
                            icon="dropdown.png"
                            isOpen={openDropdown === "overview"}
                            onToggle={() => toggleDropdown("overview")}
                        >
                            <NavItem
                                to="/app/overviews/revenues"
                                icon="revenues.png"
                            >
                                Revenues
                            </NavItem>
                            <NavItem
                                to="/app/overviews/power"
                                icon="power_facilities.png"
                            >
                                Electricity
                            </NavItem>
                            {hasStorageFacilities && (
                                <NavItem
                                    to="/app/overviews/storage"
                                    icon="storage_facilities.png"
                                >
                                    Storage
                                </NavItem>
                            )}
                            {hasWarehouse && (
                                <NavItem
                                    to="/app/overviews/resources"
                                    icon="resources.png"
                                >
                                    Resources
                                </NavItem>
                            )}
                            {discoveredGreenhouse && (
                                <NavItem
                                    to="/app/overviews/emissions"
                                    icon="emissions.png"
                                >
                                    Emissions
                                </NavItem>
                            )}
                        </NavDropdown>

                        {/* Facilities Dropdown */}
                        <NavDropdown
                            label="Facilities"
                            icon="dropdown.png"
                            isOpen={openDropdown === "facilities"}
                            onToggle={() => toggleDropdown("facilities")}
                        >
                            <NavItem
                                to="/app/facilities/power"
                                icon="power_facilities.png"
                            >
                                Power Facilities
                            </NavItem>
                            <NavItem
                                to="/app/facilities/storage"
                                icon="storage_facilities.png"
                            >
                                Storage Facilities
                            </NavItem>
                            {hasWarehouse && (
                                <NavItem
                                    to="/app/facilities/extraction"
                                    icon="extraction_facilities.png"
                                >
                                    Extraction Facilities
                                </NavItem>
                            )}
                            <NavItem
                                to="/app/facilities/functional"
                                icon="functional_facilities.png"
                            >
                                Functional Facilities
                            </NavItem>
                            {/* Technology (conditional) */}
                            {hasLaboratory && (
                                <NavItem
                                    to="/app/technology"
                                    icon="technology.png"
                                >
                                    Technology
                                </NavItem>
                            )}
                        </NavDropdown>

                        {/* Community Dropdown */}
                        <NavDropdown
                            label="Community"
                            icon="dropdown.png"
                            isOpen={openDropdown === "community"}
                            onToggle={() => toggleDropdown("community")}
                        >
                            {hasNetwork && (
                                <NavItem
                                    to="/app/community/electricity-markets"
                                    icon="network.png"
                                >
                                    Electricity Markets
                                </NavItem>
                            )}
                            {/* Resources Market (conditional) */}
                            {hasWarehouse && (
                                <NavItem
                                    to="/app/resource-market"
                                    icon="resource_market.png"
                                >
                                    Resources Market
                                </NavItem>
                            )}
                            <NavItem
                                to="/app/community/messages"
                                icon="messages.png"
                            >
                                Messages
                            </NavItem>
                            <NavItem to="/app/community/map" icon="map.png">
                                Map
                            </NavItem>
                            <NavItem
                                to="/app/community/scoreboard"
                                icon="scoreboard.png"
                            >
                                Scoreboard
                            </NavItem>
                        </NavDropdown>

                        {/* Mobile-only links */}
                        <div className="md:hidden">
                            <NavItem to="/wiki/introduction" icon="wiki.png">
                                Game Wiki
                            </NavItem>
                            <NavItem to="/changelog" icon="changelog.png">
                                Changelog
                            </NavItem>
                        </div>

                        {/* Logout */}
                        <NavItem to="/logout" icon="logout.png">
                            Logout
                        </NavItem>
                    </ul>
                </div>
            </nav>

            {/* Notification Popup Modal */}
            <NotificationPopup
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
            />
        </>
    );
}

interface NavItemProps {
    to: LinkProps["to"];
    icon: string;
    children: React.ReactNode;
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
                <img
                    src="/static/images/icons/construction.png"
                    alt="Construction"
                    className="w-4 h-4 dark:"
                />
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
                    <img
                        src="/static/images/icons/technology.png"
                        alt="Technology"
                        className="w-4 h-4"
                    />
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
                            <i className="fa fa-exclamation-circle"></i>
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

function NavItem({ to, icon, children }: NavItemProps) {
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
                <img
                    src={`/static/images/icons/${icon}`}
                    alt=""
                    className="w-5 h-5"
                />
                <span>{children}</span>
            </Link>
        </li>
    );
}

interface NavDropdownProps {
    label: string;
    icon: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function NavDropdown({
    label,
    icon,
    isOpen,
    onToggle,
    children,
}: NavDropdownProps) {
    return (
        <li className="w-full md:w-auto md:relative border-b-2 border-pine/20 dark:border-dark-border/50 md:border-none">
            <button
                onClick={onToggle}
                className={`flex items-center gap-2 px-4 py-3 text-pine dark:text-dark-text-primary hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors w-full ${
                    isOpen ? "bg-tan-hover dark:bg-dark-bg-tertiary" : ""
                }`}
            >
                <img
                    src={`/static/images/icons/${icon}`}
                    alt=""
                    className="w-5 h-5"
                />
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
                <ul className="bg-bone/50 dark:bg-dark-bg-tertiary md:absolute md:left-0 md:top-full md:bg-bone dark:md:bg-dark-bg-secondary md:shadow-lg md:min-w-[200px] md:border-2 md:border-pine-darker dark:md:border-dark-border">
                    {children}
                </ul>
            )}
        </li>
    );
}
