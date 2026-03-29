/** Map-related API calls. */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api-helpers";

export const mapApi = {
    /** Get the entire map with all tiles and their resources. */
    getMap: () => apiClient.get<ApiResponse<"/api/v1/map", "get">>("/map"),

    /** Settle on a region by its ID. */
    settleRegion: (regionId: number) =>
        apiClient.post<ApiResponse<"/api/v1/map/settle", "post">>(
            "/map/settle",
            { region_id: regionId },
        ),
};
