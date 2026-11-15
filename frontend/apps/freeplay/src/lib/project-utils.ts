/** Utilities for working with projects (construction and research). */

import { useMemo } from "react";

import { useProjects } from "@/hooks/use-projects";
import { ProjectCategory } from "@/types/projects";

/**
 * List of all technology types (research projects). Based on TechnologyType
 * enum from energetica/enums.py
 */
const TECHNOLOGY_TYPES = [
    "mathematics",
    "mechanical_engineering",
    "thermodynamics",
    "physics",
    "building_technology",
    "mineral_extraction",
    "transport_technology",
    "materials",
    "civil_engineering",
    "aerodynamics",
    "chemistry",
    "nuclear_engineering",
] as const;

function useProjectsById() {
    const { data } = useProjects();
    return useMemo(() => {
        if (data === undefined) return undefined;
        return new Map(data.projects.map((p) => [p.id, p]));
    }, [data]);
}

// function useProject(id: number) {
//     const projectsById = useProjectsById();
//     if (projectsById === undefined) return undefined;
//     return projectsById.get(id) ?? null;
// }

export function useProjectQueue(projectCategory: ProjectCategory) {
    const { data } = useProjects();
    const projectsById = useProjectsById();
    return useMemo(() => {
        if (data === undefined || projectsById === undefined) return undefined;
        const ids =
            projectCategory === "construction"
                ? data.construction_queue
                : data.research_queue;
        return ids.map((id, index) => ({
            isFirst: index === 0,
            isLast: index === ids.length - 1,
            ...projectsById.get(id)!,
        }));
    }, [data, projectCategory, projectsById]);
}

/** Check if a project type is a technology (research project). */
export function isTechnologyType(projectType: string): boolean {
    return TECHNOLOGY_TYPES.includes(
        projectType as (typeof TECHNOLOGY_TYPES)[number],
    );
}

/** Check if a project is a construction project. */
export function isConstructionProject(project: { type: string }): boolean {
    return !isTechnologyType(project.type);
}

/** Check if a project is a research project. */
export function isResearchProject(project: { type: string }): boolean {
    return isTechnologyType(project.type);
}
