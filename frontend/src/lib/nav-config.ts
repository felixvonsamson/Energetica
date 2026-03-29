import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import * as lucideReact from "lucide-react";

export interface NavLinkConfig {
    type: "link";
    label: string;
    to: LinkProps["to"];
    params?: LinkProps["params"];
    icon: LucideIcon;
}

export interface NavGroupConfig {
    type: "dropdown";
    label: string;
    icon: LucideIcon;
    children: NavLinkConfig[];
}

type NavItemConfig = NavLinkConfig | NavGroupConfig;

export const navConfig: NavItemConfig[] = [
    {
        type: "link",
        label: "Dashboard",
        to: "/app/dashboard",
        icon: lucideReact.LayoutDashboard,
    },
    {
        type: "dropdown",
        label: "Overviews",
        icon: lucideReact.TrendingUp,
        children: [
            {
                type: "link",
                label: "Cash Flow",
                to: "/app/overviews/cash-flow",
                icon: lucideReact.Coins,
            },
            {
                type: "link",
                label: "Power",
                to: "/app/overviews/power",
                icon: lucideReact.Zap,
            },
            {
                type: "link",
                label: "Storage",
                to: "/app/overviews/storage",
                icon: lucideReact.BatteryFull,
            },
            {
                type: "link",
                label: "Resources",
                to: "/app/overviews/resources",
                icon: lucideReact.Package,
            },
            {
                type: "link",
                label: "Emissions",
                to: "/app/overviews/emissions",
                icon: lucideReact.Leaf,
            },
            {
                type: "link",
                label: "Electricity Markets",
                to: "/app/overviews/electricity-markets",
                icon: lucideReact.Network,
            },
        ],
    },
    {
        type: "dropdown",
        label: "Facilities",
        icon: lucideReact.Factory,
        children: [
            {
                type: "link",
                label: "Management",
                to: "/app/facilities/manage",
                icon: lucideReact.SlidersVertical,
            },
            {
                type: "link",
                label: "Power Priorities",
                to: "/app/facilities/power-priorities",
                icon: lucideReact.ListOrdered,
            },
            {
                type: "link",
                label: "Power Facilities",
                to: "/app/facilities/power",
                icon: lucideReact.Zap,
            },
            {
                type: "link",
                label: "Storage Facilities",
                to: "/app/facilities/storage",
                icon: lucideReact.BatteryFull,
            },
            {
                type: "link",
                label: "Extraction Facilities",
                to: "/app/facilities/extraction",
                icon: lucideReact.Pickaxe,
            },
            {
                type: "link",
                label: "Functional Facilities",
                to: "/app/facilities/functional",
                icon: lucideReact.Warehouse,
            },
            {
                type: "link",
                label: "Technology",
                to: "/app/facilities/technology",
                icon: lucideReact.FlaskConical,
            },
        ],
    },
    {
        type: "dropdown",
        label: "Community",
        icon: lucideReact.Globe,
        children: [
            {
                type: "link",
                label: "Electricity Markets",
                to: "/app/community/electricity-markets",
                icon: lucideReact.Network,
            },
            {
                type: "link",
                label: "Resources Market",
                to: "/app/community/resource-market",
                icon: lucideReact.Package,
            },
            {
                type: "link",
                label: "Messages",
                to: "/app/community/messages",
                icon: lucideReact.Mail,
            },
            {
                type: "link",
                label: "Map",
                to: "/app/community/map",
                icon: lucideReact.Map,
            },
            {
                type: "link",
                label: "Leaderboards",
                to: "/app/community/leaderboards",
                icon: lucideReact.Trophy,
            },
        ],
    },
];

export const navConfigFooter: NavItemConfig[] = [
    {
        type: "link",
        label: "Game Wiki",
        to: "/app/wiki/$slug",
        params: { slug: "introduction" },
        icon: lucideReact.BookMarked,
    },
    {
        type: "link",
        label: "Changelog",
        to: "/app/changelog",
        icon: lucideReact.List,
    },
];
