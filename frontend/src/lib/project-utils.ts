/** Utilities for working with projects (construction and research). */

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

/**
 * Check if a project type is a technology (research project).
 *
 * @param projectType - The project type string
 * @returns True if the project is a research project, false if construction
 */
export function isTechnologyType(projectType: string): boolean {
    return TECHNOLOGY_TYPES.includes(
        projectType as (typeof TECHNOLOGY_TYPES)[number],
    );
}

/**
 * Check if a project is a construction project.
 *
 * @param project - Project object with a type field
 * @returns True if the project is a construction project
 */
export function isConstructionProject(project: { type: string }): boolean {
    return !isTechnologyType(project.type);
}

/**
 * Check if a project is a research project.
 *
 * @param project - Project object with a type field
 * @returns True if the project is a research project
 */
export function isResearchProject(project: { type: string }): boolean {
    return isTechnologyType(project.type);
}
