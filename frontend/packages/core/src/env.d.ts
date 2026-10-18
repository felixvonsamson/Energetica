/// <reference types="vite/client" />

// The build-time variables this package reads, typed for this package's own
// typecheck. The combined app declares the same ones in src/vite-env.d.ts. An app
// that does not declare them still compiles this package, reading them as `any`.
interface ImportMetaEnv {
    readonly VITE_APEX_DOMAIN?: string;
    readonly VITE_LOBBY_URL?: string;
    readonly VITE_DEV_INSTANCE_SLUG?: string | null;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
