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
    Pickaxe,
    Warehouse,
    BookMarked,
    List,
    SlidersVertical,
    ListOrdered,
    Network,
} from "lucide-react";

export interface Capabilities {
    has_laboratory: boolean;
    has_warehouse: boolean;
    has_storage: boolean;
    has_network: boolean;
    has_greenhouse_gas_effect: boolean;
}

export interface NavLinkConfig {
    type: "link";
    label: string;
    to: LinkProps["to"];
    icon: LucideIcon;
}

export interface NavGroupConfig {
    type: "dropdown";
    label: string;
    icon: LucideIcon;
    children: NavLinkConfig[];
}

/** Control whether locked routes are hidden or shown as disabled */
export const SHOW_LOCKED_ROUTES_AS_DISABLED = true;

export type NavigationItemConfig = NavLinkConfig | NavGroupConfig;

export const navigationConfig: NavigationItemConfig[] = [
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
                label: "Cash Flow",
                to: "/app/overviews/cash-flow",
                icon: Coins,
            },
            {
                type: "link",
                label: "Power",
                to: "/app/overviews/power",
                icon: Zap,
            },
            {
                type: "link",
                label: "Storage",
                to: "/app/overviews/storage",
                icon: BatteryFull,
            },
            {
                type: "link",
                label: "Resources",
                to: "/app/overviews/resources",
                icon: Package,
            },
            {
                type: "link",
                label: "Emissions",
                to: "/app/overviews/emissions",
                icon: Leaf,
            },
            {
                type: "link",
                label: "Networks",
                to: "/app/overviews/networks",
                icon: Network,
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
                label: "Power Priorities",
                to: "/app/facilities/power-priorities",
                icon: ListOrdered,
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
                icon: Network,
            },
            {
                type: "link",
                label: "Resources Market",
                to: "/app/community/resource-market",
                icon: Package,
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
];

/** Additional navigation items for mobile sidebar only */
export const mobileOnlyNavigation: NavigationItemConfig[] = [
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
