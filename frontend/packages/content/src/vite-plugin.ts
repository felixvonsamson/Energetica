import mdx from "@mdx-js/rollup";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { PluginOption } from "vite";

import remarkImageImports from "./remark-image-imports";

/**
 * The Vite plugin that compiles this package's MDX. Every app that renders the
 * wiki or the changelog adds it to its Vite config, so they all compile the
 * content the same way.
 *
 * A Vite config that imports this module must be loaded with `vite
 * --configLoader runner`. By default Vite leaves a workspace package's imports
 * for Node to load, and Node cannot load this package's TypeScript files.
 */
export function contentMdx(): PluginOption {
    return mdx({
        // remarkImageImports turns figure paths into imports, so a missing
        // figure is a build error. See its module comment.
        remarkPlugins: [remarkGfm, remarkMath, remarkImageImports],
        rehypePlugins: [rehypeSlug, rehypeKatex],
    });
}
