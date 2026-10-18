# Wiki Pages

Wiki pages are hosted in two places:

-   In the game: `/app/wiki/introduction`
-   On the landing page: `/wiki/introduction`

Both render the same pages, written in MDX to combine markdown with React components.

## File Structure

The pages live in the `@energetica/content` workspace package, so every app renders
the same files:

```
frontend/packages/content/src/
├── wiki/                   # MDX source files, one per page
│   ├── introduction.mdx
│   └── map.mdx
├── assets/wiki/            # Figures
├── components/             # Components the pages import
│   ├── mdx-content.tsx     # Prose wrapper that every app renders pages inside
│   └── wind-table.tsx      # Example: complex table component
├── wiki-pages.ts           # wikiPages: every page by slug
└── vite-plugin.ts          # contentMdx(): the Vite plugin that compiles the MDX
```

Each app has its own route that looks the slug up in `wikiPages`:
`frontend/src/routes/app/wiki/$slug.tsx` in the game and
`frontend/apps/landing/src/routes/wiki/$slug.tsx` on the landing page. A new `.mdx`
file in `wiki/` is a new page in both; see [Dynamic Route](#dynamic-route) for the
navigation links.

## Writing MDX Pages

**Basic example (`introduction.mdx`):**

```mdx
# Page Title

Regular markdown content with **bold** and _italic_.

## Sections work normally

-   Lists work
-   As expected

You can use React components inline:

<div className="p-4 bg-blue-100 rounded-lg">Custom styled content</div>
```

**Math equations:**

```mdx
Inline: $E = mc^2$

Block:

$$
p_{i,n} = p_{i,base} \times pm(hp, n_i)
$$
```

**Importing components:**

A page imports the package's own components through its `#content/` subpath imports,
and the shared UI through `@energetica/ui`:

```mdx
import { WindTable } from "#content/components/wind-table";

### Wind Capacity Factors

<WindTable />
```

**Anchor links:**

Headings automatically get IDs in kebab-case format based on the heading text. Link to them with hash fragments:

```mdx
## Wind Capacity Factors

See [Wind Capacity Factors](#wind-capacity-factors) for details.
```

## Reusable Components

Complex elements (tables, charts) should be React components in
`frontend/packages/content/src/components/`:

```tsx
// components/wind-table.tsx
export function WindTable() {
    const data = {
        /* ... */
    };
    return <table>{/* ... */}</table>;
}
```

Use in MDX:

```mdx
import { WindTable } from "#content/components/wind-table";

<WindTable />
```

A component that depends on the app rendering the page cannot live in the package.
`LockedLink` is one: in the game it checks the player's capabilities, and on the
landing page nobody has unlocked anything. A page uses such a component without
importing it, and each app passes its own version to the page through the
`components` prop. `WikiComponents` in `wiki-pages.ts` lists them, so an app that
forgets one fails to type-check.

```mdx
See the <LockedLink to="/app/facilities/power-priorities" capability="has_network">Power Priorities</LockedLink> page.
```

## Figures

Figures live in `frontend/packages/content/src/assets/wiki/` and are referenced by
module path, not by URL. Both markdown and JSX syntax work:

```mdx
![Probability distribution of heatwaves](#content/assets/wiki/heatwave_probability_distribution.webp)

<img
    className="h-75"
    src="#content/assets/wiki/cloud_coverage.webp"
    alt="Cloud coverage over a year"
/>
```

A remark plugin (`frontend/packages/content/src/remark-image-imports.ts`) turns each
of those into an import before the page compiles, so Vite resolves the file at build
time. Get the path wrong and the build fails with the offending file named, rather
than the page rendering a broken image for a reader. See [Images](images.md) for the
wider convention.

## Styling

**Automatic styling with prose:**

The `prose` classes from `@tailwindcss/typography` automatically style all markdown elements. See `frontend/packages/ui/src/styles/global.css`.

**What prose handles:**

-   Headings (`h1`-`h6`) - Bold, proper spacing, sizing
-   Links (`a`) - Blue color, hover underline
-   Code - Gray background, proper padding, no backticks
-   Tables - Borders, header background, centred text
-   Lists - Proper bullets/numbers, spacing
-   Blockquotes - Left border, background

**Dark mode:**

Use `dark:prose-invert` to automatically adapt colors for dark mode.

**Overriding prose styles:**

Use `not-prose` for custom components that shouldn't inherit prose styles:

```mdx
<div className="not-prose">
    <CustomComponent />
</div>
```

**Custom prose modifications:**

Override specific prose styles with utility classes:

```tsx
<article className="prose prose-lg dark:prose-invert prose-headings:text-pine">
```

Or customize globally in `frontend/packages/ui/src/styles/global.css` in the prose CSS custom properties and element styles.

## Setup

**Dependencies:**

-   `@mdx-js/rollup` - MDX compiler
-   `@tailwindcss/typography` - Prose styling
-   `remark-gfm` - Tables, strikethrough, task lists
-   `remark-math` + `rehype-katex` - Math equations

**Configuration in `vite.config.ts`:**

```ts
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

plugins: [
    mdx({
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [rehypeKatex],
    }),
    // ... other plugins
];
```

**Tailwind v4 configuration (`frontend/packages/ui/src/styles/global.css`):**

The typography plugin is imported and configured with custom prose styles:

```css
@plugin "@tailwindcss/typography";

/* Custom prose styles in @layer base */
.prose {
    --tw-prose-body: var(--text-foreground);
    --tw-prose-headings: var(--text-foreground);
    /* ... etc */
}
```

See `frontend/packages/ui/src/styles/global.css` for full configuration.

**Additional resources:**

-   KaTeX CSS is loaded in `index.html` for math rendering`

### Dynamic Route

Each app's `$slug.tsx` route maps URL slugs to MDX files through `wikiPages`:

-   `/wiki/introduction` → `packages/content/src/wiki/introduction.mdx`
-   `/wiki/power-facilities` → `packages/content/src/wiki/power-facilities.mdx`

Add new pages by:

1. Creating the `.mdx` file in `frontend/packages/content/src/wiki/`
2. Adding a navigation link to both sidebars: `frontend/src/components/wiki/wiki-sidebar.tsx`
   in the game and `frontend/apps/landing/src/components/wiki/wiki-sidebar-public.tsx` on
   the landing page

## Best Practices

-   **Keep MDX simple** - Use markdown for content, components for interactivity
-   **Extract complex markup** - Tables/charts → React components
-   **Use game UI components** - `<Money />`, `<AssetName />` for consistency
-   **Follow naming conventions** - URL slugs use kebab-case (`power-facilities`)
-   **Use `not-prose` for custom components** - Prevents prose from interfering with component styles
