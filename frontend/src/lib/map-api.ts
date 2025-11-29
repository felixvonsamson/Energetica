/** Map-related API calls. */

import { apiClient } from "./api-client";
import type { ApiResponse } from "@/types/api-helpers";

export const mapApi = {
    /** Get the entire map with all tiles and their resources. */
    getMap: () => apiClient.get<ApiResponse<"/api/v1/map", "get">>("/map"),
};
