/**
 * Proves that lint rejects imports across the frontend's boundaries. Each case
 * lints a deliberate violation as if it were the content of a real file.
 */

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const BOUNDARY_RULES = [
    "import/no-extraneous-dependencies",
    "import/no-relative-packages",
    "import/no-restricted-paths",
    "import/no-unresolved",
    "no-restricted-imports",
];

let eslint: ESLint;

beforeAll(() => {
    eslint = new ESLint({
        cwd: __dirname,
        // Only the boundary rules, and without type information, which none of them
        // needs. Linting with the full typed setup takes minutes.
        ruleFilter: ({ ruleId }) => BOUNDARY_RULES.includes(ruleId),
        overrideConfig: {
            languageOptions: { parserOptions: { project: null } },
        },
    });
});

async function violatedRules(
    filePath: string,
    code: string,
): Promise<string[]> {
    const [result] = await eslint.lintText(code, { filePath });
    return (result?.messages ?? []).map((m) => m.ruleId ?? m.message);
}

describe("frontend boundaries", () => {
    it("allows a shared package to import what it declares", async () => {
        expect(
            await violatedRules(
                "packages/ui/src/lib/example.ts",
                'import { formatMoney } from "@energetica/core/format-utils";\nimport { clsx } from "clsx";\nexport const x = [formatMoney, clsx];\n',
            ),
        ).toEqual([]);
    });

    it("rejects one bundle importing another bundle's files", async () => {
        expect(
            await violatedRules(
                "src/routes-lobby/example.tsx",
                'import { Route } from "@/routes/app/logout";\nexport const x = Route;\n',
            ),
        ).toContain("import/no-restricted-paths");
    });

    it("rejects the app-local @/ alias in a shared package", async () => {
        expect(
            await violatedRules(
                "packages/ui/src/lib/example.ts",
                'import { queryKeys } from "@/lib/query-client";\nexport const x = queryKeys;\n',
            ),
        ).toContain("no-restricted-imports");
    });

    it("rejects a relative import into another package", async () => {
        expect(
            await violatedRules(
                "packages/ui/src/lib/example.ts",
                'import { formatMoney } from "../../../core/src/format-utils";\nexport const x = formatMoney;\n',
            ),
        ).toContain("import/no-relative-packages");
    });

    it("rejects a parent-relative import inside a shared package", async () => {
        expect(
            await violatedRules(
                "packages/ui/src/components/example.tsx",
                'import { cn } from "../lib/utils";\nexport const x = cn;\n',
            ),
        ).toContain("no-restricted-imports");
    });

    it("allows a shared package's own subpath imports", async () => {
        expect(
            await violatedRules(
                "packages/ui/src/components/example.tsx",
                'import { cn } from "#ui/lib/utils";\nexport const x = cn;\n',
            ),
        ).toEqual([]);
    });

    // The shadcn CLI writes imports like this one into the files it adds.
    it("rejects a package importing itself by name", async () => {
        expect(
            await violatedRules(
                "packages/ui/src/components/example.tsx",
                'import { cn } from "@energetica/ui/lib/utils";\nexport const x = cn;\n',
            ),
        ).toContain("no-restricted-imports");
    });

    // The root package declares these, so they resolve from a shared package.
    it.each(["react", "react-dom", "echarts"])(
        "rejects an undeclared %s import in a shared package",
        async (name) => {
            expect(
                await violatedRules(
                    "packages/core/src/example.ts",
                    `import * as dep from "${name}";\nexport const x = dep;\n`,
                ),
            ).toContain("import/no-extraneous-dependencies");
        },
    );

    it("rejects a dependency that only another package declares", async () => {
        expect(
            await violatedRules(
                "packages/core/src/example.ts",
                'import { clsx } from "clsx";\nexport const x = clsx;\n',
            ),
        ).toContain("import/no-unresolved");
    });
});
