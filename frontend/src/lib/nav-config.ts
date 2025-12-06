import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
    LayoutDashboard,
    TrendingUp,
    Zap,
    BatteryFull,
    Package,
    Leaf,
    Coins,
    FlaskConical,
    Globe,
    Factory,
    Mail,
    Map,
    Trophy,
    LogOut,
    Pickaxe,
    Warehouse,
    BookMarked,
    List,
    SlidersVertical,
} from "lucide-react";

export interface Capabilities {
    has_laboratory: boolean;
    has_warehouse: boolean;
    has_storage: boolean;
    has_network: boolean;
    has_greenhouse_gas_effect: boolean;
}

export interface NavItemConfig {
    type: "link";
    label: string;
    to: LinkProps["to"];
    icon: LucideIcon;
    visibility?: (capabilities: Capabilities) => boolean;
}

export interface NavDropdownConfig {
    type: "dropdown";
    label: string;
    icon: LucideIcon;
    children: NavItemConfig[];
    visibility?: (capabilities: Capabilities) => boolean;
}

export type NavigationItem = NavItemConfig | NavDropdownConfig;

export const navigationConfig: NavigationItem[] = [
    {
        type: "link",
        label: "Dashboard",
        to: "/app/dashboard",
        icon: LayoutDashboard,
    },
    {
        type: "dropdown",
        label: "Overviews",
        icon: TrendingUp,
        children: [
            {
                type: "link",
                label: "Revenues",
                to: "/app/overviews/revenues",
                icon: Coins,
            },
            {
                type: "link",
                label: "Electricity",
                to: "/app/overviews/power",
                icon: Zap,
            },
            {
                type: "link",
                label: "Storage",
                to: "/app/overviews/storage",
                icon: BatteryFull,
                visibility: (cap) => cap.has_storage,
            },
            {
                type: "link",
                label: "Resources",
                to: "/app/overviews/resources",
                icon: Package,
                visibility: (cap) => cap.has_warehouse,
            },
            {
                type: "link",
                label: "Emissions",
                to: "/app/overviews/emissions",
                icon: Leaf,
                visibility: () => false, // TODO: Get from capabilities when available
            },
        ],
    },
    {
        type: "dropdown",
        label: "Facilities",
        icon: Factory,
        children: [
            {
                type: "link",
                label: "Management",
                to: "/app/facilities/manage",
                icon: SlidersVertical,
            },
            {
                type: "link",
                label: "Power Facilities",
                to: "/app/facilities/power",
                icon: Zap,
            },
            {
                type: "link",
                label: "Storage Facilities",
                to: "/app/facilities/storage",
                icon: BatteryFull,
            },
            {
                type: "link",
                label: "Extraction Facilities",
                to: "/app/facilities/extraction",
                icon: Pickaxe,
                visibility: (cap) => cap.has_warehouse,
            },
            {
                type: "link",
                label: "Functional Facilities",
                to: "/app/facilities/functional",
                icon: Warehouse,
            },
            {
                type: "link",
                label: "Technology",
                to: "/app/facilities/technology",
                icon: FlaskConical,
                visibility: (cap) => cap.has_laboratory,
            },
        ],
    },
    {
        type: "dropdown",
        label: "Community",
        icon: Globe,
        children: [
            {
                type: "link",
                label: "Electricity Markets",
                to: "/app/community/electricity-markets",
                icon: Zap,
                visibility: (cap) => cap.has_network,
            },
            {
                type: "link",
                label: "Resources Market",
                to: "/app/community/resource-market",
                icon: Package,
                visibility: (cap) => cap.has_warehouse,
            },
            {
                type: "link",
                label: "Messages",
                to: "/app/community/messages",
                icon: Mail,
            },
            {
                type: "link",
                label: "Map",
                to: "/app/community/map",
                icon: Map,
            },
            {
                type: "link",
                label: "Leaderboards",
                to: "/app/community/leaderboards",
                icon: Trophy,
            },
        ],
    },
    {
        type: "link",
        label: "Logout",
        to: "/logout",
        icon: LogOut,
    },
];

/** Additional navigation items for mobile sidebar only */
export const mobileOnlyNavigation: NavigationItem[] = [
    {
        type: "link",
        label: "Game Wiki",
        to: "/wiki/introduction",
        icon: BookMarked,
    },
    {
        type: "link",
        label: "Changelog",
        to: "/changelog",
        icon: List,
    },
];
