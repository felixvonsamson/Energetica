/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
    /** Apex domain the game instances live under, e.g. "energetica-game.org". */
    readonly VITE_APEX_DOMAIN?: string;
    /**
     * Local-dev override for the lobby dev-server origin the app bundle's "log
     * in" bounce targets (default `http://localhost:5174`). See
     * `lib/instances.ts`.
     */
    readonly VITE_LOBBY_URL?: string;
    /**
     * Local-dev override for the app dev-server origin the lobby bundle's
     * "enter run" links target (default `http://localhost:5173`). See
     * `lib/lobby.ts`.
     */
    readonly VITE_APP_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
