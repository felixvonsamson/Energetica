/**
 * Inline expandable panel for construction/research projects on facility pages.
 * Renders the same DashboardSection as the dashboard, at the very top of the
 * page.
 *
 * Usage: manage `isOpen` state in the parent page, render `<ProjectsPanel>`
 * at the top of the content area, and place `<ProjectsPanelToggle>` wherever
 * the toggle button should appear (e.g. alongside the Compare button).
 */

import { type LucideIcon } from "lucide-react";

import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { ProjectList } from "@/components/dashboard/progress-lists";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProjectCategory } from "@/types/projects";

interface ProjectsPanelProps {
    projectCategory: ProjectCategory;
    icon: LucideIcon;
    /** Title text shown inside the DashboardSection header */
    panelTitle: string;
    isOpen: boolean;
}

export function ProjectsPanel({
    projectCategory,
    icon: Icon,
    panelTitle,
    isOpen,
}: ProjectsPanelProps) {
    if (!isOpen) return null;

    const sectionTitle = (
        <>
            <Icon className="inline w-4 h-4" /> {panelTitle}
        </>
    );

    return (
        <div className="mb-4 w-full">
            <DashboardSection title={sectionTitle}>
                <ProjectList projectCategory={projectCategory} />
            </DashboardSection>
        </div>
    );
}

interface ProjectsPanelToggleProps {
    count: number;
    icon: LucideIcon;
    /** Short label used in the button, e.g. "Construction Projects" */
    buttonLabel: string;
    isOpen: boolean;
    onToggle: () => void;
}

/** Toggle button with count badge. Renders nothing when count is 0. */
export function ProjectsPanelToggle({
    count,
    icon: Icon,
    buttonLabel,
    isOpen,
    onToggle,
}: ProjectsPanelToggleProps) {
    if (count === 0) return null;

    return (
        <div className="relative inline-flex">
            <Button
                variant="outline"
                onClick={onToggle}
                className="flex items-center gap-2"
            >
                <Icon className="w-5 h-5" />
                {isOpen ? "Hide" : "Show"} {buttonLabel}
            </Button>
            <span
                className={cn(
                    "absolute -top-2 -right-2",
                    "min-w-5 h-5 px-1 rounded-full",
                    "bg-destructive text-destructive-foreground",
                    "text-xs font-bold leading-none",
                    "flex items-center justify-center",
                )}
            >
                {count}
            </span>
        </div>
    );
}
