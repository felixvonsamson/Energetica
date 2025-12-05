/** Game engine configuration API calls. */

import { apiClient } from "./api-client";
import type { GameEngineConfig } from "@/types/game";

export const gameApi = {
    /** Get game engine configuration (clock time and simulation speed). */
    getEngine: () => apiClient.get<GameEngineConfig>("/game/engine"),
};
