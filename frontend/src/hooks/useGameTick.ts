/** Hook to access game tick context. Provides current tick number. */

import { GameTickContext } from "@/contexts/GameTickContext";
import { useContext } from "react";

export function useGameTick() {
    const context = useContext(GameTickContext);
    if (!context) {
        throw new Error("useGameTick must be used within GameTickProvider");
    }
    return context;
}
