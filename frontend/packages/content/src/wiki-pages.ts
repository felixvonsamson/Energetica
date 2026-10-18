import {
    contentPage,
    type ContentPage,
    type MdxPage,
} from "#content/content-page";

// Eagerly import every page, so navigating between them never waits on a fetch.
const modules = import.meta.glob<{ default: MdxPage }>("./wiki/*.mdx", {
    eager: true,
});

/** Every wiki page, by slug. The slug is the file name, such as `introduction`. */
export const wikiPages: Record<string, ContentPage> = Object.fromEntries(
    Object.entries(modules).map(([path, module]) => [
        path.match(/\/([^/]+)\.mdx$/)?.[1] ?? "",
        contentPage(module.default),
    ]),
);
