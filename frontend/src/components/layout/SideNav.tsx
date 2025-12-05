/** Mobile side navigation drawer that slides in from the right */

import { useEffect } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { X, ChevronDown } from "lucide-react";

interface SideNavProps {
    isOpen: boolean;
    onClose: () => void;
    capabilities: {
        has_laboratory: boolean;
        has_warehouse: boolean;
        has_storage: boolean;
        has_network: boolean;
        has_greenhouse_gas_effect: boolean;
    } | null;
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

    const hasWarehouse = capabilities?.has_warehouse ?? false;
    const hasNetwork = capabilities?.has_network ?? false;
    const hasLaboratory = capabilities?.has_laboratory ?? false;
    const hasStorageFacilities = capabilities?.has_storage ?? false;
    const discoveredGreenhouse = false;

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
                    {/* Dashboard */}
                    <NavItem
                        to="/app/dashboard"
                        icon="dashboard.png"
                        onClose={onClose}
                    >
                        Dashboard
                    </NavItem>

                    {/* Profile */}
                    <NavItem
                        to="/app/profile"
                        icon="profile.png"
                        onClose={onClose}
                    >
                        Profile
                    </NavItem>

                    {/* Production Overview Dropdown */}
                    <NavDropdown
                        label="Production Overview"
                        icon="dropdown.png"
                        isOpen={openDropdown === "overview"}
                        onToggle={() => onToggleDropdown("overview")}
                    >
                        <NavItem
                            to="/app/overviews/revenues"
                            icon="revenues.png"
                            onClose={onClose}
                        >
                            Revenues
                        </NavItem>
                        <NavItem
                            to="/app/overviews/power"
                            icon="power_facilities.png"
                            onClose={onClose}
                        >
                            Electricity
                        </NavItem>
                        {hasStorageFacilities && (
                            <NavItem
                                to="/app/overviews/storage"
                                icon="storage_facilities.png"
                                onClose={onClose}
                            >
                                Storage
                            </NavItem>
                        )}
                        {hasWarehouse && (
                            <NavItem
                                to="/app/overviews/resources"
                                icon="resources.png"
                                onClose={onClose}
                            >
                                Resources
                            </NavItem>
                        )}
                        {discoveredGreenhouse && (
                            <NavItem
                                to="/app/overviews/emissions"
                                icon="emissions.png"
                                onClose={onClose}
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
                        onToggle={() => onToggleDropdown("facilities")}
                    >
                        <NavItem
                            to="/app/facilities/power"
                            icon="power_facilities.png"
                            onClose={onClose}
                        >
                            Power Facilities
                        </NavItem>
                        <NavItem
                            to="/app/facilities/storage"
                            icon="storage_facilities.png"
                            onClose={onClose}
                        >
                            Storage Facilities
                        </NavItem>
                        {hasWarehouse && (
                            <NavItem
                                to="/app/facilities/extraction"
                                icon="extraction_facilities.png"
                                onClose={onClose}
                            >
                                Extraction Facilities
                            </NavItem>
                        )}
                        <NavItem
                            to="/app/facilities/functional"
                            icon="functional_facilities.png"
                            onClose={onClose}
                        >
                            Functional Facilities
                        </NavItem>
                        {hasLaboratory && (
                            <NavItem
                                to="/app/technology"
                                icon="technology.png"
                                onClose={onClose}
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
                        onToggle={() => onToggleDropdown("community")}
                    >
                        {hasNetwork && (
                            <NavItem
                                to="/app/community/electricity-markets"
                                icon="network.png"
                                onClose={onClose}
                            >
                                Electricity Markets
                            </NavItem>
                        )}
                        {hasWarehouse && (
                            <NavItem
                                to="/app/resource-market"
                                icon="resource_market.png"
                                onClose={onClose}
                            >
                                Resources Market
                            </NavItem>
                        )}
                        <NavItem
                            to="/app/community/messages"
                            icon="messages.png"
                            onClose={onClose}
                        >
                            Messages
                        </NavItem>
                        <NavItem
                            to="/app/community/map"
                            icon="map.png"
                            onClose={onClose}
                        >
                            Map
                        </NavItem>
                        <NavItem
                            to="/app/community/scoreboard"
                            icon="scoreboard.png"
                            onClose={onClose}
                        >
                            Scoreboard
                        </NavItem>
                    </NavDropdown>

                    {/* Wiki */}
                    <NavItem
                        to="/wiki/introduction"
                        icon="wiki.png"
                        onClose={onClose}
                    >
                        Game Wiki
                    </NavItem>

                    {/* Changelog */}
                    <NavItem
                        to="/changelog"
                        icon="changelog.png"
                        onClose={onClose}
                    >
                        Changelog
                    </NavItem>

                    {/* Logout */}
                    <NavItem to="/logout" icon="logout.png" onClose={onClose}>
                        Logout
                    </NavItem>
                </ul>
            </div>
        </>
    );
}

interface NavItemProps {
    to: LinkProps["to"];
    icon: string;
    children: React.ReactNode;
    onClose: () => void;
}

function NavItem({ to, icon, children, onClose }: NavItemProps) {
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
        <li className="border-b border-pine/20 dark:border-dark-border/50">
            <button
                onClick={onToggle}
                className={
                    "flex items-center gap-2 px-4 py-3 text-pine dark:text-dark-text-primary hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors w-full"
                }
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
                <ul className="pl-8 bg-bone/50 dark:bg-dark-bg-secondary">
                    {children}
                </ul>
            )}
        </li>
    );
}
