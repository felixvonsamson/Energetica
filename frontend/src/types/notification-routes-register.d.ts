// Fills AppRouteRegistry with the real route union, so AppRoute resolves to the app's actual
// routes rather than to bare `string`.
//
// This is the same trick TanStack Router uses for its own `Register` interface, and that
// src/router.d.ts already uses for StaticDataRouteOption: an empty interface that a separate
// file merges into.
//
// It is a separate file because notification-config.tsx, where AppRoute is used, is compiled by
// four programs, and only one of them can afford to see the route tree. `src/routeTree.gen.ts`
// imports every route module, so any file importing it drags the whole game app into every
// program that reaches that file. tsconfig.landing.json and tsconfig.lobby.json reach
// notification-config.tsx through shared components (top-bar → notification-popup), and
// excluding it does not help: `exclude` only filters a program's root files, it never stops a
// transitive import. Those programs deliberately lack src/main.tsx, where the router's
// `Register` augmentation lives, so the game routes would type-check without a registered
// router and every `navigate({ search })` in them would degrade to an implicit `any`.
//
// Keeping the import here instead confines it to the app's own program. Nothing imports this
// file; tsconfig.json picks it up because it includes all of src/, and the landing, lobby and
// service-worker configs leave it out. In those three, AppRouteRegistry stays empty and
// AppRoute falls back to `string` — they never validate routes, which is fine, because the
// app's own program does and that is what CI runs.
import type { FileRouteTypes } from "@/routeTree.gen";

declare module "@/types/notification-routes" {
    interface AppRouteRegistry {
        route: FileRouteTypes["fullPaths"];
    }
}
