/** Game engine configuration API calls. */

import type { GameEngineConfig } from "@/types/game";
import { apiClient } from "@energetica/core/api-client";

export const gameApi = {
    /** Get game engine configuration (clock time and simulation speed). */
    getEngine: () => apiClient.get<GameEngineConfig>("/game/engine"),
};
