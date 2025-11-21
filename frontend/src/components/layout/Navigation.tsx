/**
 * Main navigation bar component.
 * Displays primary navigation links with dropdown menus.
 */

import { useState } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { Menu, ChevronDown } from "lucide-react";
import { useCapabilities } from "@/hooks/useCapabilities";

export function Navigation() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const capabilities = useCapabilities();

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

    return (
        <nav className="bg-tan-green dark:bg-dark-bg-secondary border-b-2 border-pine-darker dark:border-dark-border">
            <div className="px-4">
                {/* Mobile menu button */}
                <div className="flex items-center justify-between md:hidden py-3">
                    <div className="flex items-center gap-2">
                        <img
                            src="/static/images/icon.svg"
                            alt="Energetica"
                            className="w-6 h-6"
                        />
                        <span className="text-pine dark:text-dark-text-primary font-bold">Energetica</span>
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
                            to="/app/overviews/electricity"
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
                    </NavDropdown>

                    {/* Community Dropdown */}
                    <NavDropdown
                        label="Community"
                        icon="dropdown.png"
                        isOpen={openDropdown === "community"}
                        onToggle={() => toggleDropdown("community")}
                    >
                        <NavItem
                            to="/app/community/messages"
                            icon="messages.png"
                        >
                            Messages
                        </NavItem>
                        {hasNetwork && (
                            <NavItem
                                to="/app/community/network"
                                icon="network.png"
                            >
                                Network
                            </NavItem>
                        )}
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

                    {/* Technology (conditional) */}
                    {hasLaboratory && (
                        <NavItem to="/app/technology" icon="technology.png">
                            Technology
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
    );
}

interface NavItemProps {
    to: LinkProps["to"];
    icon: string;
    children: React.ReactNode;
}

function NavItem({ to, icon, children }: NavItemProps) {
    return (
        <li className="w-full md:w-auto border-b border-pine/10 dark:border-dark-border/30 md:border-none">
            <Link
                to={to}
                className="flex items-center gap-2 px-4 py-3 text-pine dark:text-dark-text-primary hover:bg-tan-hover dark:hover:bg-dark-bg-tertiary transition-colors"
                activeProps={{
                    className: "bg-tan-hover dark:bg-dark-bg-tertiary font-semibold"
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
