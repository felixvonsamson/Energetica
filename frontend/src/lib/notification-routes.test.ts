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
// thing it is checking.
//
// What enforces it is `bun run typecheck`, which CI runs as the "Typecheck" step of the
// frontend-checks job. Running this file under vitest proves nothing extra: the check is
// entirely at compile time, and `expect` is here only so the assertion has a use and does not
// trip noUnusedLocals. CI does not currently run vitest at all — the unit-tests job is pytest
// and the type-check job is Pyright, both Python. So do not read the file extension as a second
// line of defence; the typechecker is the only one.
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
