// Fills AppRouteRegistry with the real route union, so AppRoute resolves to the app's actual
// routes rather than to bare `string`.
//
// This is the same trick TanStack Router uses for its own `Register` interface, and that
// src/router.d.ts already uses for StaticDataRouteOption: an empty interface that a separate
// file merges into.
//
// It is a separate file because notification-routes.ts, where AppRoute is declared, is also
// compiled by the service worker's program (tsconfig.sw.json), and that program must not see
// the route tree. `src/routeTree.gen.ts` imports every route module, so any file importing it
// drags the whole game app into every program that reaches that file. The service worker only
// needs AppRoute as a type it can pass along, not the real route union.
//
// Keeping the import here instead confines it to the app's own program. Nothing imports this
// file; tsconfig.json picks it up because it includes all of src/, and tsconfig.sw.json leaves
// it out. There, AppRouteRegistry stays empty and AppRoute falls back to `string`. It never
// validates routes, which is fine, because the app's own program does and that is what CI runs.
import type { FileRouteTypes } from "@/routeTree.gen";

declare module "@/types/notification-routes" {
    interface AppRouteRegistry {
        route: FileRouteTypes["fullPaths"];
    }
}
