import { useHasCapability } from "@/hooks/use-capabilities";
import type { PlayerCapabilities } from "@/types/capabilities";
import type { ContentHost } from "@energetica/content/content-links";

/**
 * The pages write capability names as plain strings, so a misspelt one reads as
 * not unlocked.
 */
function useHasNamedCapability(capability: string): boolean {
    return useHasCapability(capability as keyof PlayerCapabilities);
}

/** How the wiki and the changelog render in the game. */
export const contentHost: ContentHost = {
    wikiPagePath: (slug) => `/app/wiki/${slug}`,
    servesGame: true,
    useHasCapability: useHasNamedCapability,
};
