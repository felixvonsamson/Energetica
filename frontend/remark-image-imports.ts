import type { ImportDeclaration, Program } from "estree";
import type { Root, RootContent } from "mdast";
import type {
    MdxJsxAttribute,
    MdxJsxAttributeValueExpression,
    MdxJsxFlowElement,
    MdxJsxTextElement,
} from "mdast-util-mdx-jsx";
import type { MdxjsEsm } from "mdast-util-mdxjs-esm";
import { visit } from "unist-util-visit";

/**
 * Rewrite image sources in MDX into JavaScript imports, so the bundler resolves
 * them at build time.
 *
 * Without this, `![alt](./figure.webp)` and `<img src="./figure.webp" />`
 * compile to opaque strings: a renamed, moved or deleted figure survives the
 * build and fails in the reader's browser. An import makes the same mistake a
 * build error, and lets each bundle emit only the figures it actually
 * references, under a content-hashed filename.
 *
 * Only sources that name a local module are rewritten — those starting with
 * `./`, `../` or the `@/` alias for `frontend/src`. Everything else is left
 * exactly as written: remote URLs, protocol-relative URLs, `data:` URIs, and
 * web-root-absolute paths, none of which a bundler owns.
 *
 * The wiki's own figures all use `@/`, matching how the rest of the frontend
 * imports. Relative paths are accepted anyway because `![alt](./figure.webp)`
 * is the form an author reaches for first, and the one a markdown preview
 * renders — leaving it out would let exactly that spelling fall through as an
 * unchecked string, which is the failure this plugin exists to remove.
 *
 * Both syntaxes are covered. A markdown image becomes an `<img>` element
 * carrying its alt text and title; a JSX `<img>` keeps every attribute it had
 * and only has its `src` swapped for the imported binding.
 */
export default function remarkImageImports() {
    return (tree: Root): void => {
        // One import per distinct source, in first-seen order.
        const bindings = new Map<string, string>();

        const bindingFor = (url: string): string => {
            let name = bindings.get(url);
            if (name === undefined) {
                name = `_mdxImage${bindings.size}`;
                bindings.set(url, name);
            }
            return name;
        };

        visit(tree, "image", (node, index, parent) => {
            if (parent === undefined || index === undefined) return;
            if (!isLocalModule(node.url)) return;

            const attributes: MdxJsxAttribute[] = [
                { type: "mdxJsxAttribute", name: "alt", value: node.alt ?? "" },
                {
                    type: "mdxJsxAttribute",
                    name: "src",
                    value: identifierAttributeValue(bindingFor(node.url)),
                },
            ];
            if (node.title != null) {
                attributes.push({
                    type: "mdxJsxAttribute",
                    name: "title",
                    value: node.title,
                });
            }
            parent.children[index] = {
                type: "mdxJsxTextElement",
                name: "img",
                attributes,
                children: [],
            } as RootContent;
        });

        visit(tree, ["mdxJsxFlowElement", "mdxJsxTextElement"], (node) => {
            const element = node as MdxJsxFlowElement | MdxJsxTextElement;
            if (element.name !== "img") return;
            for (const attribute of element.attributes) {
                if (attribute.type !== "mdxJsxAttribute") continue;
                if (attribute.name !== "src") continue;
                // A src that is already an expression (`src={figure}`) is
                // someone else's import, and nothing to resolve here.
                if (typeof attribute.value !== "string") continue;
                if (!isLocalModule(attribute.value)) continue;
                attribute.value = identifierAttributeValue(
                    bindingFor(attribute.value),
                );
            }
        });

        if (bindings.size > 0) {
            tree.children.unshift(importsNode(bindings));
        }
    };
}

/**
 * Whether a source names a module the bundler resolves, rather than a URL it
 * should pass through untouched.
 */
function isLocalModule(url: string): boolean {
    return (
        url.startsWith("./") || url.startsWith("../") || url.startsWith("@/")
    );
}

/** `{name}` as an MDX attribute value, i.e. a JSX expression container. */
function identifierAttributeValue(
    name: string,
): MdxJsxAttributeValueExpression {
    return {
        type: "mdxJsxAttributeValueExpression",
        value: name,
        data: {
            estree: {
                type: "Program",
                sourceType: "module",
                body: [
                    {
                        type: "ExpressionStatement",
                        expression: { type: "Identifier", name },
                    },
                ],
            },
        },
    };
}

/** A single MDX ESM node holding one default import per collected source. */
function importsNode(bindings: Map<string, string>): MdxjsEsm {
    const body: ImportDeclaration[] = [...bindings].map(([url, name]) => ({
        type: "ImportDeclaration",
        source: { type: "Literal", value: url },
        specifiers: [
            {
                type: "ImportDefaultSpecifier",
                local: { type: "Identifier", name },
            },
        ],
        attributes: [],
    }));
    const program: Program = { type: "Program", sourceType: "module", body };
    return { type: "mdxjsEsm", value: "", data: { estree: program } };
}
