import type { ComponentType } from "react";

// Loaded through import.meta.glob, like the wiki pages, so the type is declared
// here. A plain import would need every app to declare `*.mdx` modules.
const modules = import.meta.glob<{ default: ComponentType }>(
    "./changelog.mdx",
    { eager: true },
);

/** The changelog page's content. */
export const Changelog = modules["./changelog.mdx"]!.default;
