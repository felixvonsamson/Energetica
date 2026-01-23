/**
 * Type definitions for game engine and configuration.
 *
 * These types correspond to backend schemas in energetica/schemas/game.py
 */

import type { ApiSchema } from "@/types/api-helpers";

/**
 * Game engine configuration response from GET /api/v1/game/engine
 *
 * Contains clock time and simulation speed settings that control how the game
 * progresses. These are typically read-only and set by administrators.
 */
export type GameEngineConfig = ApiSchema<"GameEngineOut">;
