import {
    BatteryFull,
    BookOpen,
    Clock,
    FlaskConical,
    Gem,
    Hammer,
    Leaf,
    Map,
    Network,
    SlidersVertical,
    Trophy,
    Warehouse,
    Zap,
} from "lucide-react";

/**
 * The wiki's pages in sidebar order, with the name shown for each. The app's
 * and the landing page's wiki sidebars both list these, and each wiki page uses
 * its name as the browser tab title.
 */
export const wikiNav = [
    { slug: "introduction", label: "Introduction", icon: BookOpen },
    { slug: "map", label: "The Map", icon: Map },
    { slug: "projects", label: "Projects", icon: Hammer },
    { slug: "power-facilities", label: "Power Facilities", icon: Zap },
    {
        slug: "storage-facilities",
        label: "Storage Facilities",
        icon: BatteryFull,
    },
    { slug: "resources", label: "Natural Resources", icon: Gem },
    {
        slug: "functional-facilities",
        label: "Functional Facilities",
        icon: Warehouse,
    },
    { slug: "technologies", label: "Technology", icon: FlaskConical },
    {
        slug: "power-management",
        label: "Power Management",
        icon: SlidersVertical,
    },
    { slug: "network", label: "Network", icon: Network },
    { slug: "time-and-weather", label: "Time & Weather", icon: Clock },
    { slug: "climate-effects", label: "Climate Change", icon: Leaf },
    { slug: "progression", label: "Progression", icon: Trophy },
];

/**
 * The page title for a wiki page, such as `"Wiki: The Map"`. An unknown slug
 * gives `"Game Wiki"`.
 */
export function wikiPageTitle(slug: string): string {
    const label = wikiNav.find((page) => page.slug === slug)?.label;
    return label ? `Wiki: ${label}` : "Game Wiki";
}
