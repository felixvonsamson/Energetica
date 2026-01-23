/**
 * Hook to access current player context. Must be used within
 * RequireSettledPlayer.
 *
 * Returns the current player ID and other player-level context. This is the
 * primary hook for accessing "who is the current player" information.
 *
 * The player_id comes from the auth context and is only available for
 * authenticated users with a settled player.
 *
 * @example
 *     const { playerId } = useCurrentPlayer();
 *     // playerId is guaranteed to exist (non-null)
 *
 * @throws {Error} If used outside of RequireSettledPlayer or if player not
 *   settled
 */

import { useAuth } from "@/hooks/useAuth";

interface CurrentPlayerContext {
    /** The current player's ID (guaranteed to be non-null) */
    playerId: number;
    /** The current player's username */
    username: string;
}

export function useCurrentPlayer(): CurrentPlayerContext {
    const { user } = useAuth();

    // These should always be non-null when called within RequireSettledPlayer
    if (!user?.player_id) {
        throw new Error(
            "useCurrentPlayer must be used within RequireSettledPlayer. Player ID not available.",
        );
    }

    return {
        playerId: user.player_id,
        username: user.username,
    };
}
