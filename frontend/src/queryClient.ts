import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { GameError } from "./api/client";
import { showToast } from "./toast";

export const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: (error, query) => {
            console.error('Global query error:', error, query.queryKey);
            handleGlobalError(error);
        },
    }),
    mutationCache: new MutationCache({
        onError: (error, mutation) => {
            console.error('Global mutation error:', error);
            handleGlobalError(error);
        },
    }),
});

function handleGlobalError(error: unknown) {
    console.error("Global API error:", error);

    if (error instanceof GameError) {
        // showToast(`Game error: ${error.game_exception_type}`, "error");
        showToast(error.message, "error");
    } else if (error instanceof Error) {
        showToast(error.message, "error");
    } else {
        showToast("An unknown error occurred", "error");
    }
}