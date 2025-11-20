/**
 * Main navigation bar component.
 * Displays primary navigation links with dropdown menus.
 */

import { useState } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { Menu, ChevronDown } from "lucide-react";

export function Navigation() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    // TODO: Get these from user achievements/progress
    const hasWarehouse = false;
    const hasNetwork = false;
    const hasLaboratory = false;
    const hasStorageFacilities = false;
    const discoveredGreenhouse = false;

    const toggleDropdown = (dropdown: string) => {
        setOpenDropdown(openDropdown === dropdown ? null : dropdown);
    };

    return (
        <nav className="bg-[#c9d4b5] border-b-2 border-[#1a2f0d]">
            <div className="px-4">
                {/* Mobile menu button */}
                <div className="flex items-center justify-between md:hidden py-3">
                    <div className="flex items-center gap-2">
                        <img
                            src="/static/images/icon.svg"
                            alt="Energetica"
                            className="w-6 h-6"
                        />
                        <span className="text-black font-bold">Energetica</span>
                    </div>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="text-black p-2"
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
        <li className="w-full md:w-auto">
            <Link
                to={to}
                className="flex items-center gap-2 px-4 py-3 text-black hover:bg-[#b5c09d] transition-colors"
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
        <li className="w-full md:w-auto md:relative">
            <button
                onClick={onToggle}
                className="flex items-center gap-2 px-4 py-3 text-black hover:bg-[#b5c09d] transition-colors w-full"
            >
                <img
                    src={`/static/images/icons/${icon}`}
                    alt=""
                    className="w-5 h-5"
                />
                <span>{label}</span>
                <ChevronDown
                    size={16}
                    className={`ml-auto transition-transform ${
                        isOpen ? "rotate-180" : ""
                    }`}
                />
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <ul className="md:absolute md:left-0 md:top-full md:bg-[#e8dcc0] md:shadow-lg md:min-w-[200px] md:border-2 md:border-[#1a2f0d]">
                    {children}
                </ul>
            )}
        </li>
    );
}
