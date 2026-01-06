# MDX Content (Wiki Pages)

Wiki pages use MDX to combine markdown content with React components.

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

**Tailwind v4 configuration (`src/styles/global.css`):**

The typography plugin is imported and configured with custom prose styles:

```css
@plugin "@tailwindcss/typography";

/* Custom prose styles in @layer base */
.prose {
    --tw-prose-body: var(--text-primary);
    --tw-prose-headings: var(--text-primary);
    /* ... etc */
}
```

See `src/styles/global.css` for full configuration.

**Additional resources:**

-   KaTeX CSS is loaded in `index.html` for math rendering

## File Structure

```
frontend/src/
├── content/wiki/           # MDX source files
│   ├── introduction.mdx
│   └── map.mdx
├── components/wiki/        # Reusable wiki components
│   ├── WikiLayout.tsx      # Layout wrapper with navigation
│   └── WindTable.tsx       # Example: complex table component
└── routes/wiki/
    └── $slug.tsx           # Dynamic route handler
```

## Writing MDX Pages

**Basic example (`introduction.mdx`):**

```mdx
import { cn } from "@/lib/classname-utils";

# Page Title

Regular markdown content with **bold** and _italic_.

## Sections work normally

-   Lists work
-   As expected

You can use React components inline:

<div className={cn("p-4 bg-blue-100 rounded-lg")}>Custom styled content</div>
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

```mdx
import { WindTable } from "@/components/wiki/WindTable";

### Wind Capacity Factors

<WindTable />
```

**Anchor links:**

Headings automatically get IDs in kebab-case format. Link to them with hash fragments:

```mdx
## Wind Capacity Factors

See [Wind Capacity Factors](#wind-capacity-factors) for details.
```

## Dynamic Route

`routes/wiki/$slug.tsx` maps URL slugs to MDX files:

-   `/wiki/introduction` → `content/wiki/introduction.mdx`
-   `/wiki/power-facilities` → `content/wiki/power-facilities.mdx`

Add new pages by:

1. Creating `.mdx` file in `content/wiki/`
2. Adding navigation link to `WikiLayout.tsx`

## Reusable Components

Complex elements (tables, charts) should be React components:

```tsx
// components/wiki/WindTable.tsx
export function WindTable() {
    const data = {
        /* ... */
    };
    return <table>{/* ... */}</table>;
}
```

Use in MDX:

```mdx
import { WindTable } from "@/components/wiki/WindTable";

<WindTable />
```

## Images

Place in `public/wiki/` and reference:

```mdx
![Solar panel UI](/wiki/solar-ui.png)
```

## Styling

**Automatic styling with prose:**

The `prose` classes from `@tailwindcss/typography` automatically style all markdown elements:

```tsx
<article className="prose prose-lg dark:prose-invert">
    {/* All markdown styled automatically */}
</article>
```

**What prose handles:**

-   Headings (`h1`-`h6`) - Bold, proper spacing, sizing
-   Links (`a`) - Blue color, hover underline
-   Code - Gray background, proper padding, no backticks
-   Tables - Borders, header background, centered text
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

Or customize globally in `src/styles/global.css` in the prose CSS custom properties and element styles.

## Best Practices

-   **Keep MDX simple** - Use markdown for content, components for interactivity
-   **Extract complex markup** - Tables/charts → React components
-   **Use game UI components** - `<Money />`, `<AssetName />` for consistency
-   **Follow naming conventions** - URL slugs use kebab-case (`power-facilities`)
-   **Use `not-prose` for custom components** - Prevents prose from interfering with component styles
