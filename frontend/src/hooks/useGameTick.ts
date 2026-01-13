/** Hook to access game tick context. Provides current tick number. */

import { useContext } from "react";

import { GameTickContext } from "@/contexts/game-tick-context";

export function useGameTick() {
    const context = useContext(GameTickContext);
    if (!context) {
        throw new Error("useGameTick must be used within GameTickProvider");
    }
    return context;
}
