# Animation & Transition Guidelines

Guidelines for creating smooth, purposeful animations in the React frontend.

## Philosophy

Use subtle, purposeful animations that enhance UX without being distracting.

## When to Animate

### ✅ DO Animate

- State transitions (hover, active, focus)
- Content loading (skeletons, spinners)
- Feedback (success, error, progress)
- Layout changes (expand/collapse, show/hide)
- Data updates (number changes, bar fills)

### ❌ DON'T Animate

- Static content on page load (no "fade in on mount")
- Every single element (creates visual noise)
- Critical actions (makes UI feel slow)
- Large data lists (performance impact)

## Standard Durations

Use consistent timing across the app:

```ts
// Tailwind duration classes
"duration-75"; // 75ms  - Instant feedback (hover, active)
"duration-150"; // 150ms - Quick transitions (tooltips, dropdowns)
"duration-300"; // 300ms - Standard transitions (dialogs, cards)
"duration-500"; // 500ms - Slow transitions (progress bars, loaders)
"duration-700"; // 700ms - Very slow (decorative only)
```

**Default:** Use `duration-300` for most transitions unless you have a specific reason.

## Easing Functions

```ts
// Tailwind easing classes
"ease-linear"; // Constant speed - for progress bars, spinners
"ease-in"; // Start slow - for exits, hiding
"ease-out"; // End slow - for entrances, showing (DEFAULT)
"ease-in-out"; // Both - for symmetric transitions
```

**Default:** Use `ease-out` for most transitions (feels more natural).

## Standard Patterns

### Hover States

```ts
// Buttons, cards, interactive elements
className = "transition-colors duration-150 hover:bg-brand-green";

// With shadow
className = "transition-all duration-150 hover:shadow-md hover:scale-[1.02]";
```

### State Feedback (Success/Error)

```ts
// Borders, backgrounds
className = "transition-all duration-300 ease-out border-2 border-green-600";

// Avoid jarring color jumps - use tints/shades
// ❌ BAD: bg-white → bg-green-600 (too strong)
// ✅ GOOD: bg-white → bg-green-50 (subtle)
```

### Progress Bars

```ts
// Smooth width changes
className="h-full transition-all duration-300 ease-out"
style={{ width: `${progress}%` }}
```

### Loading Spinners

```ts
// Continuous rotation
className = "animate-spin"; // Tailwind built-in
```

### Dialogs

```ts
// Fade in background
<div className="transition-opacity duration-300 ease-out opacity-0 data-[state=open]:opacity-100">

// Scale in content
<div className="transition-all duration-300 ease-out scale-95 data-[state=open]:scale-100">
```

## Color Intensity Guidelines

**Problem:** Bright, saturated colors are jarring and hard to look at.

**Solution:** Use tints (lighter) for backgrounds, full colors for borders/text.

```ts
// ❌ BAD - Too strong
className = "bg-green-600 text-white"; // Harsh on eyes

// ✅ GOOD - Muted backgrounds
className =
    "bg-green-50 dark:bg-green-900/20 border-2 border-green-600 text-green-800";
```

**Pattern for feedback states:**

```ts
// Light mode: 50-shade background, 600-shade border, 800-shade text
className = "bg-green-50 border-green-600 text-green-800";

// Dark mode: 900-shade with opacity background, 400-500 border, 300 text
className = "dark:bg-green-900/20 dark:border-green-500 dark:text-green-300";
```

## Examples from the Codebase

### Weather Progress Bars

```ts
// Smooth width changes as weather data updates
<div
    className="h-full bg-yellow-500 transition-all duration-300"
    style={{ width: `${(irradiance / 1000) * 100}%` }}
/>
```

### Quiz Answer Feedback

```ts
// Before answering - subtle hover
className="border-2 border-pine hover:border-brand-green hover:shadow-md
           transition-all duration-300 ease-out"

// After correct answer - muted green
className="bg-green-50 dark:bg-green-900/20 border-2 border-green-600
           text-green-800 dark:text-green-300 transition-all duration-300"
```

### Button States

```ts
// Standard button pattern
className="bg-tan-green hover:bg-brand-green text-white
           transition-colors duration-150
           disabled:opacity-50 disabled:cursor-not-allowed"
```

## Accessibility Considerations

**Respect user preferences:**

```ts
// Check for reduced motion preference
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Tailwind handles this automatically** if you use the built-in classes.

## Performance Best Practices

### ✅ DO

- Animate `transform` and `opacity` (GPU accelerated)
- Use `transition-colors` for color changes only
- Use `will-change` sparingly for complex animations

### ❌ DON'T

- Animate `width`, `height`, `top`, `left` directly (causes reflow)
- Use `transition-all` on elements with many properties
- Animate during initial page load

```ts
// ❌ BAD - Animates everything, causes reflow
className = "transition-all duration-300";

// ✅ GOOD - Specific properties only
className = "transition-[colors,shadow] duration-300";

// ✅ BETTER - Use transform for movement
className =
    "transform translate-x-0 hover:translate-x-2 transition-transform duration-300";
```

## Animation Checklist

Before adding an animation, ask:

- [ ] Does this improve UX or just look cool? (Only add if improves UX)
- [ ] Is the duration appropriate? (150-300ms for most cases)
- [ ] Are the colors muted enough? (Use tints for backgrounds)
- [ ] Is it accessible? (Respects prefers-reduced-motion)
- [ ] Is it performant? (Uses transform/opacity when possible)
- [ ] Is it consistent? (Matches other animations in the app)

## See Also

- [styling.md](styling.md) - Tailwind patterns and theme colors
- [best-practices.md](best-practices.md) - General React patterns
