import { describe, expect, it } from "vitest";

import type { AppRoute } from "@/types/notification-routes";

// AppRoute only resolves to the app's real routes while
// src/types/notification-routes-register.d.ts is part of this program. Nothing imports that
// file — tsconfig.json picks it up because it includes all of src/ — so deleting it, or adding
// it to an exclude list, would leave the registry empty. AppRoute would quietly widen to
// `string`, every path in notification-config.tsx would still compile, and the route checking
// this whole arrangement exists for would be gone with nothing to show for it.
//
// The assertion has to live outside the register file, or it would disappear along with the
// thing it is checking. A test is the natural home: it is covered by `bun run typecheck` and by
// CI's unit-test job, and neither is easy to drop by accident.
//
// tsconfig.landing.json and tsconfig.lobby.json exclude this file. Those programs leave the
// register file out on purpose, so AppRoute is `string` there and the assertion below would be
// a false alarm rather than a real one. Only the app's own program can answer this question.
type RegistryIsPopulated = string extends AppRoute ? never : true;

describe("notification route registry", () => {
    it("resolves AppRoute to the real route union, not string", () => {
        // A type error here means the registry went empty. Read the comment above.
        const populated: RegistryIsPopulated = true;

        expect(populated).toBe(true);
    });
});
