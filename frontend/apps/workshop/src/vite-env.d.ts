interface ImportMetaEnv {
    /** Apex domain the game instances live under, e.g. "energetica-game.org". */
    readonly VITE_APEX_DOMAIN?: string;
    /**
     * Local-dev override for the lobby dev-server origin the "log in" bounce
     * targets (default `http://localhost:5174`). See
     * `@energetica/core/instances`.
     */
    readonly VITE_LOBBY_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
