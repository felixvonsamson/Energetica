interface ImportMetaEnv {
    /**
     * Local-dev override for the app dev-server origin the lobby's "enter run"
     * links target (default `http://localhost:5173`). See `lib/lobby.ts`.
     */
    readonly VITE_APP_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
