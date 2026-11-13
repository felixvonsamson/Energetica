/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
    /** Apex domain the game instances live under, e.g. "energetica-game.org". */
    readonly VITE_APEX_DOMAIN?: string;
    /**
     * Local-dev override for the lobby dev-server origin the app bundle's "log
     * in" bounce targets (default `http://localhost:5174`). See
     * `@energetica/core/instances`.
     */
    readonly VITE_LOBBY_URL?: string;
    /**
     * The single live instance slug the app dev server is pinned to, injected
     * at dev-server startup (never in a prod build). Lets the account menu mark
     * that instance and disable hops to the account's other (prod) runs. See
     * `@energetica/core/instances` and `vite.config.ts`.
     */
    readonly VITE_DEV_INSTANCE_SLUG?: string | null;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
