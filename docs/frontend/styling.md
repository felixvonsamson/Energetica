# Styling with Tailwind

TODO possibly merge into [component-library.md](/docs/frontend/component-library.md)

Guidelines for styling components with Tailwind CSS and the project's theme system.

## Use Tailwind Config Colors

**Always use theme colors:**

```ts
// Good
<div className="bg-bone text-pine">

// Bad
<div style={{ backgroundColor: "#e5d9b6" }}>
```

**Available colors:**

-   `bone` - #e5d9b6 (background, cards)
-   `tan-green` - #a4be7b (buttons, accents)
-   `brand-green` - #5f8d4e (primary actions)
-   `pine` - #285430 (text, dark backgrounds)
-   `alert-red` - #f44336 (errors, warnings)
-   `alert-orange` - #f59f00 (warnings)

## Color and Text Management

### Source of Truth for Text Colors

The `<main>` element in `GameLayout.tsx` is the source of truth for content text colors:

```ts
// GameLayout.tsx - Sets text-primary for all content
<main className="bg-content-bg text-primary min-h-[calc(100vh-120px)]">
    {children}
</main>
```

**Individual pages should NOT set text colors unless deviating:**

```ts
// Good - inherits text-primary from GameLayout
function Dashboard() {
    return <div className="p-4 md:p-8">{/* content */}</div>;
}

// Bad - redundantly sets text-primary
function Dashboard() {
    return <div className="p-4 md:p-8 text-primary">{/* content */}</div>;
}
```

### Dark Mode Support

Always include dark mode variants for colors:

```ts
// Good - supports both modes
<Card className="bg-bone dark:bg-dark-bg-secondary text-bone-text dark:text-dark-text-primary">

// Bad - only light mode
<Card className="bg-bone text-black">
```

### CSS Variables for Semantic Colors

Use CSS variables for colors that change based on theme:

```ts
// Use these for theme-aware colors
className = "bg-content-bg text-primary"; // Uses var(--content-bg) and var(--text-primary)

// Use explicit colors for specific branded elements
className = "bg-bone text-bone-text"; // Always #e5d9b6 with black text
```

## Conditional Classes with clsx

```ts
import { cn } from "@/lib/utils";

<button
    className={cn(
        "px-4 py-2 rounded",
        isActive && "bg-brand-green text-white",
        isDisabled && "opacity-50 cursor-not-allowed"
    )}
>
```

## Responsive Design

Use mobile-first approach:

```ts
<div className="
    grid grid-cols-1           // Mobile
    md:grid-cols-2             // Tablet
    lg:grid-cols-4             // Desktop
">
```

## Icons

### Use lucide-react

```ts
import { Home, Settings, User } from "lucide-react";

<Home className="w-5 h-5" />
<Settings className="w-5 h-5 text-pine" />
```

**Advantages:**

-   Tree-shakeable (only bundle icons you use)
-   Consistent sizing
-   Themeable with Tailwind classes
-   TypeScript support

**Avoid:**

-   Emojis (inconsistent across platforms)
-   Font Awesome (requires loading entire font)

## Asset Colors

For facility and resource colors, use the CSS variable system defined in `global.css`:

```ts
const colorVar = `--asset-color-${facility.toLowerCase().replace(/_/g, "-")}`;

<div
    className="h-full transition-all"
    style={{
        width: `${usage * 100}%`,
        backgroundColor: `var(${colorVar})`,
    }}
/>;
```

See [ASSET_COLORS.md](ASSET_COLORS.md) for complete documentation.

## Common Patterns

### Cards and Containers

```ts
// Standard card
className = "bg-bone dark:bg-dark-bg-secondary p-6 rounded-lg";

// Card with hover effect
className =
    "bg-bone dark:bg-dark-bg-secondary p-6 rounded-lg transition-shadow duration-150 hover:shadow-md";
```

### Buttons

```ts
// Primary button
className =
    "bg-brand-green hover:bg-pine text-white px-4 py-2 rounded transition-colors duration-150";

// Secondary button
className =
    "bg-tan-green hover:bg-brand-green text-white px-4 py-2 rounded transition-colors duration-150";

// Disabled state
className =
    "bg-brand-green text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed";
```

### Input Fields

```ts
// Standard input
className =
    "border-2 border-pine rounded px-3 py-2 focus:border-brand-green focus:outline-none";

// With dark mode
className =
    "border-2 border-pine dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-pine dark:text-white";
```

### Text Styles

```ts
// Headings
className = "text-2xl font-bold text-pine dark:text-white";

// Body text (inherits from parent)
className = ""; // Let parent define color

// Muted text
className = "text-gray-600 dark:text-gray-400";

// Error text
className = "text-alert-red dark:text-red-400";
```

## Layout Utilities

### Spacing

```ts
// Consistent spacing scale
"p-4"; // 1rem padding
"p-6"; // 1.5rem padding
"p-8"; // 2rem padding

// Responsive padding
"p-4 md:p-6 lg:p-8";
```

### Flexbox

```ts
// Common flex patterns
"flex items-center justify-between"; // Navbar
"flex flex-col gap-4"; // Vertical stack
"flex flex-wrap gap-2"; // Tag list
```

### Grid

```ts
// Responsive grid
"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";

// Auto-fit grid
"grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4";
```

## Performance Tips

### Avoid Dynamic Classes

```ts
// ❌ BAD - Tailwind can't detect dynamic classes
<div className={`bg-${color}-500`}>

// ✅ GOOD - Use inline styles for dynamic values
<div style={{ backgroundColor: `var(--asset-color-${color})` }}>

// ✅ BETTER - Use cn() with conditional logic
<div className={cn(
    color === 'green' && 'bg-green-500',
    color === 'red' && 'bg-red-500',
)}>
```

### Purge Unused Styles

Tailwind automatically purges unused styles in production. Keep class names static for best results.

## Common Mistakes

### 1. Hardcoding Colors

```ts
// ❌ BAD
className = "text-black bg-white";

// ✅ GOOD
className = "text-pine dark:text-white bg-bone dark:bg-dark-bg-secondary";
```

### 2. Forgetting Dark Mode

```ts
// ❌ BAD
className = "bg-white text-black border-gray-300";

// ✅ GOOD
className =
    "bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600";
```

### 3. Overusing `transition-all`

```ts
// ❌ BAD - Animates everything
className = "transition-all";

// ✅ GOOD - Specific transitions
className = "transition-colors duration-150";
```

See [ANIMATIONS.md](ANIMATIONS.md) for animation best practices.

## Checklist

Before committing styled components:

-   [ ] Uses theme colors from tailwind.config
-   [ ] Includes dark mode variants
-   [ ] Uses semantic color variables where appropriate
-   [ ] Follows mobile-first responsive design
-   [ ] Uses lucide-react for icons
-   [ ] No hardcoded hex colors
-   [ ] Proper contrast ratios for accessibility

## See Also

-   [ANIMATIONS.md](ANIMATIONS.md) - Animation and transition guidelines
-   [ASSET_COLORS.md](ASSET_COLORS.md) - Asset-specific color system
-   [BEST_PRACTICES.md](BEST_PRACTICES.md) - General React patterns
