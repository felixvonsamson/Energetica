import mdx from "@mdx-js/rollup";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { PluginOption } from "vite";

import remarkImageImports from "#content/remark-image-imports";

/**
 * The Vite plugin that compiles this package's MDX. Every app that renders the
 * wiki or the changelog adds it to its Vite config, so they all compile the
 * content the same way.
 *
 * By default Vite leaves a workspace package's imports for Node to load. Node
 * runs TypeScript files from version 22.18 on, and resolves this package's own
 * imports through the "imports" map in its package.json, which is why lint bans
 * relative imports here. Tools that load a Vite config this way, such as the
 * Vitest VS Code extension, rely on that. The package.json scripts still pass
 * `--configLoader runner`, so building does not depend on the Node version.
 */
export function contentMdx(): PluginOption {
    return mdx({
        // remarkImageImports turns figure paths into imports, so a missing
        // figure is a build error. See its module comment.
        remarkPlugins: [remarkGfm, remarkMath, remarkImageImports],
        rehypePlugins: [rehypeSlug, rehypeKatex],
    });
}
