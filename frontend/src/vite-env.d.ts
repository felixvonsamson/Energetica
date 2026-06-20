/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
    /** Apex domain the game instances live under, e.g. "energetica-game.org". */
    readonly VITE_APEX_DOMAIN?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
