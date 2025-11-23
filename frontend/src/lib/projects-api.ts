/**
 * Projects-related API calls.
 * Handles construction and research project management.
 */

import { apiClient } from "./api-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

export const projectsApi = {
    /**
     * Get list of ongoing construction and research projects.
     */
    getProjects: () =>
        apiClient.get<ApiResponse<"/api/v1/projects", "get">>("/projects"),

    /**
     * Queue a new construction or research project.
     */
    queueProject: (data: ApiRequestBody<"/api/v1/projects", "post">) =>
        apiClient.post<void>("/projects", data),

    /**
     * Cancel an ongoing project.
     */
    cancelProject: (projectId: number) =>
        apiClient.post<
            ApiResponse<"/api/v1/projects/{project_id}:cancel", "post">
        >(`/projects/${projectId}:cancel`),

    /**
     * Pause an ongoing project.
     */
    pauseProject: (projectId: number) =>
        apiClient.post<
            ApiResponse<"/api/v1/projects/{project_id}:pause", "post">
        >(`/projects/${projectId}:pause`),

    /**
     * Resume a paused project.
     */
    resumeProject: (projectId: number) =>
        apiClient.post<
            ApiResponse<"/api/v1/projects/{project_id}:resume", "post">
        >(`/projects/${projectId}:resume`),

    /**
     * Decrease project priority in the queue.
     */
    decreasePriority: (projectId: number) =>
        apiClient.post<
            ApiResponse<
                "/api/v1/projects/{project_id}:decrease-priority",
                "post"
            >
        >(`/projects/${projectId}:decrease-priority`),

    /**
     * Increase project priority in the queue.
     */
    increasePriority: (projectId: number) =>
        apiClient.post<
            ApiResponse<
                "/api/v1/projects/{project_id}:increase-priority",
                "post"
            >
        >(`/projects/${projectId}:increase-priority`),

    /**
     * Get the catalog of all power facilities available for construction.
     */
    getPowerFacilitiesCatalog: () =>
        apiClient.get<
            ApiResponse<"/api/v1/projects/catalog/power-facilities", "get">
        >("/projects/catalog/power-facilities"),
};
