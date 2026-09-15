import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";

import remarkImageImports from "./remark-image-imports";

/** Compile MDX with the plugin, keeping JSX so the output stays readable. */
async function compileMdx(source: string): Promise<string> {
    const file = await compile(source, {
        jsx: true,
        remarkPlugins: [remarkImageImports],
    });
    return String(file);
}

/**
 * The local names the compiled module imports from `specifier`, in source
 * order. Lets the assertions talk about "whatever the plugin called it" instead
 * of pinning its naming scheme.
 */
function importedNames(code: string, specifier: string): string[] {
    const quoted = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
        `import\\s+(\\w+)\\s+from\\s+["']${quoted}["']`,
        "g",
    );
    return [...code.matchAll(pattern)].map((m) => m[1]!);
}

describe("remarkImageImports", () => {
    it("turns a markdown image into an import and a JSX element", async () => {
        const code = await compileMdx("![A wind turbine](./turbine.webp)\n");

        const [name] = importedNames(code, "./turbine.webp");
        expect(name).toBeDefined();
        expect(code).toContain(`src={${name}}`);
        expect(code).toContain('alt="A wind turbine"');
        expect(code).not.toContain('src="./turbine.webp"');
    });

    it("keeps a markdown image's title", async () => {
        const code = await compileMdx('![Alt](./figure.webp "The title")\n');

        expect(code).toContain('title="The title"');
    });

    it("rewrites the src of a JSX img and leaves its other attributes", async () => {
        const code = await compileMdx(
            '<img className="h-75" src="@/assets/wiki/cloud.webp" alt="Cloud cover" />\n',
        );

        const [name] = importedNames(code, "@/assets/wiki/cloud.webp");
        expect(name).toBeDefined();
        expect(code).toContain(`src={${name}}`);
        expect(code).toContain('className="h-75"');
        expect(code).toContain('alt="Cloud cover"');
    });

    it("rewrites JSX imgs nested inside other elements", async () => {
        const code = await compileMdx(
            '<div className="flex">\n    <img src="../assets/a.webp" alt="A" />\n</div>\n',
        );

        const [name] = importedNames(code, "../assets/a.webp");
        expect(name).toBeDefined();
        expect(code).toContain(`src={${name}}`);
    });

    it("imports a repeated path once and reuses the binding", async () => {
        const code = await compileMdx(
            "![First](./shared.webp)\n\n![Second](./shared.webp)\n",
        );

        const names = importedNames(code, "./shared.webp");
        expect(names).toHaveLength(1);
        expect(code.split(`src={${names[0]}}`)).toHaveLength(3);
    });

    it("leaves URLs no bundler owns alone", async () => {
        const sources = [
            "https://example.com/remote.webp",
            "//example.com/protocol-relative.webp",
            "/served-from-the-web-root.webp",
            "data:image/gif;base64,R0lGOD",
        ];

        for (const src of sources) {
            const code = await compileMdx(`![Alt](${src})\n`);
            expect(code).not.toMatch(/^import .* from/m);
            expect(code).toContain(src);
        }
    });

    it("leaves an img with no src alone", async () => {
        const code = await compileMdx('<img alt="" />\n');

        expect(code).not.toMatch(/^import .* from/m);
    });

    it("leaves an img whose src is already an expression alone", async () => {
        const code = await compileMdx(
            'import figure from "./figure.webp";\n\n<img src={figure} alt="" />\n',
        );

        expect(importedNames(code, "./figure.webp")).toEqual(["figure"]);
        expect(code).toContain("src={figure}");
    });

    it("emits no import declaration when there is nothing to rewrite", async () => {
        const code = await compileMdx("# Just a heading\n");

        expect(code).not.toMatch(/^import .* from/m);
    });
});
