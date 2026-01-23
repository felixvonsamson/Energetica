# Asset Color System

This document describes the asset color system used in the React frontend. Colors are derived from the legacy Jinja frontend (`energetica/static/energetica.css`, lines 65-200) to maintain visual consistency.

## Overview

Each asset (facility, resource, etc.) has a designated color used in:

- **Gauges** on the profile page
- **Charts** (future implementation)

All colors support both **light mode** and **dark mode**, with automatic switching based on the user's theme preference.

## How It Works

### CSS Variables (`frontend/src/styles/global.css`)

All asset colors are defined as CSS variables in both light and dark modes:

```css
:root {
    /* Light mode */
    --asset-color-pv-solar: rgb(255, 234, 0);
    --asset-color-coal-burner: rgb(0, 0, 0);
    /* ... etc */
}

.dark {
    /* Dark mode */
    --asset-color-pv-solar: rgb(255, 244, 80);
    --asset-color-coal-burner: rgb(120, 120, 120);
    /* ... etc */
}
```

### Usage in Components

Use inline styles with CSS variables:

```tsx
const colorVar = `--asset-color-${facility.toLowerCase().replace(/_/g, "-")}`;

<div
    className="h-full transition-all"
    style={{
        width: `${usage * 100}%`,
        backgroundColor: `var(${colorVar})`,
    }}
/>;
```

**Note:** You cannot use dynamic Tailwind classes like `bg-asset-${facility}` because Tailwind generates classes at build time, not runtime.

## Adjusting Colors

To modify a color, edit `frontend/src/styles/global.css`:

```css
/* Change PV Solar color */
:root {
    --asset-color-pv-solar: rgb(255, 200, 0); /* was: rgb(255, 234, 0) */
}

.dark {
    --asset-color-pv-solar: rgb(255, 220, 50); /* was: rgb(255, 244, 80) */
}
```

No other files need to be changed - the colors update automatically everywhere they're used.

## Future Use

These colors are ready for:

- Chart libraries (just reference the CSS variable)
- Color legends
- Any other visual indicators

Example for charts:

```tsx
const chartColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--asset-color-pv-solar")
    .trim();
```

## Related Files

- `frontend/src/styles/global.css` - Color definitions (lines 63-181)
- `frontend/src/routes/app/profile.tsx` - Example usage in gauges (lines 152-374)
- `energetica/static/energetica.css` - Legacy source (lines 65-200)
