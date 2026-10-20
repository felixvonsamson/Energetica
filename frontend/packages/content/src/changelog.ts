import { contentPage, type MdxPage } from "#content/content-page";

// Loaded through import.meta.glob, like the wiki pages, so the type is declared
// here. A plain import would need every app to declare `*.mdx` modules.
const modules = import.meta.glob<{ default: MdxPage }>("./changelog.mdx", {
    eager: true,
});

/** The changelog page. */
export const Changelog = contentPage(modules["./changelog.mdx"]!.default);
