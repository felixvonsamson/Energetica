/** The icon shown for each Workshop season. */

import { Leaf, type LucideIcon, Snowflake, Sprout, Sun } from "lucide-react";

import type { Season } from "@/lib/workshop-timeline";

export const SEASON_ICONS: Record<Season, LucideIcon> = {
    spring: Sprout,
    summer: Sun,
    autumn: Leaf,
    winter: Snowflake,
};
