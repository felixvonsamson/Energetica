# Typography System

**Created:** 2026-01-25
**Location:** `frontend/src/components/ui/typography.tsx`

## Why We Built This

The codebase had inconsistent text styling with ad-hoc Tailwind classes scattered everywhere (`text-4xl font-bold`, `text-xl font-semibold`, etc.). No h1/h2/h3 HTML tags in use—just styled divs and paragraphs. This created:

- **Maintenance burden**: Changing heading styles meant finding/replacing Tailwind classes across files
- **Inconsistency**: Same semantic element (e.g., dialog titles) styled differently in different places
- **No semantic HTML**: Accessibility and SEO suffered without proper heading hierarchy
- **Data display problems**: Numbers in tables were hard to scan due to variable-width fonts

## Core Design Principles

### 1. Composition Over Configuration

**Decision:** Font choice is independent of heading level.

**Why:** Expletus Sans (our brand font) is decorative, not structural. Forcing all H1s to be Expletus would be inflexible—a dashboard H1 has different needs than a logo. Instead, we provide `TypographyBrand` as a compositional wrapper that can be applied anywhere:

```tsx
// Flexible - brand font when needed
<TypographyBrand className="text-4xl">Energetica</TypographyBrand>
<TypographyH1>Dashboard</TypographyH1>

// Not flexible - all H1s locked to Expletus
<h1>Energetica</h1> {/* Always Expletus */}
<h1>Dashboard</h1> {/* Also Expletus - wrong! */}
```

This separates **what it is** (H1) from **how it looks** (brand font).

### 2. Three-Tier Component Architecture

Following shadcn's pattern:

1. **Semantic** (`TypographyH1`, `TypographyP`) - Structural meaning
2. **Visual** (`TypographyMuted`, `TypographyLarge`) - Appearance modifiers
3. **Domain-specific** (`Money`, `DataValue`) - Game-specific data display

This enables natural composition:

```tsx
<TypographyH1>
    Revenue: <Money amount={50000} />
</TypographyH1>
```

Money component doesn't need to know it's in an H1. H1 doesn't need to know about currency formatting. Clean separation of concerns.

### 3. Monospace for Data

**Decision:** All numerical data uses monospace font (`ui-monospace` system stack).

**Why:**

- **Scanability**: Tables with monospace numbers align visually, even without explicit column width settings
- **Stability**: Variable-width fonts make numbers "jump" when values update (1,111 vs 9,999 have different widths)
- **Professional aesthetic**: Technical/data-heavy interfaces benefit from monospace for precision-oriented content
- **User feedback**: Colleagues were skeptical, but data is more legible in tables when monospaced

`DataValue` is the base primitive—all data components (Money, Power, Energy) build on it.

### 4. Single File, Not Folder

**Decision:** All typography components in one `typography.tsx` file.

**Why:**

- Components are small and related—splitting into `heading.tsx`, `text.tsx`, `brand.tsx` creates unnecessary fragmentation
- Easier to see the full typography system at a glance
- Avoids index.ts barrel export complexity
- Follows the "locality of reference" principle—related code stays together

When file gets unwieldy (>500 lines?), consider splitting. Not needed at ~200 lines.

## Migration Strategy

**Non-breaking**: Components added alongside existing Tailwind patterns. No big-bang refactor required.

**Progressive adoption**:

1. New code uses typography components (enforced via CLAUDE.md)
2. Existing code refactored opportunistically when files are touched
3. High-value pages (dashboard, dialogs) prioritized for visual consistency

**Example migration**: About page went from `<p className="text-4xl font-bold">` to `<TypographyH1>` without changing behavior—just improved maintainability and semantics.

## Future Considerations

### Data Components (Not Yet Implemented)

The `DataValue` foundation enables systematic expansion:

```tsx
<Power value={facility.power} />     // formatPower + monospace
<Energy value={battery.capacity} />  // formatEnergy + monospace
<Temperature value={15.5} />          // formatTemperature + monospace
```

These can be added progressively as format-utils functions are componentized. Each follows the same pattern: format logic from `lib/format-utils.ts` + `DataValue` wrapper for monospace styling.

### Table Integration

When implementing `@tanstack/react-table`, numeric cells should default to:

```tsx
<TableCell className="font-mono text-right">
    <DataValue>{value}</DataValue>
</TableCell>
```

Right-alignment + monospace = optimal data legibility.

### Font Swapping

Currently using `ui-monospace` system font stack (SF Mono on macOS, Consolas on Windows, etc.). To switch to a specific font like Roboto Mono:

1. Add to `global.css` font imports
2. Update `DataValue` component: `className={cn("font-['Roboto_Mono']", ...)}`

Single change point—all data components update automatically.

## Key Takeaways

1. **Typography is infrastructure**: Good typography is invisible—it just works. Bad typography creates friction.
2. **Composability scales**: Components that combine well are more valuable than monolithic solutions.
3. **Separate structure from style**: Semantic meaning (H1) vs visual treatment (brand font) should be independent choices.
4. **Monospace for data**: Non-negotiable for data-heavy interfaces. Tables and numerical displays demand it.
5. **Incremental adoption**: New systems work best when they coexist with legacy patterns during migration.

---

**See also:**

- `CLAUDE.md` - Usage patterns and examples
- `frontend/src/components/ui/typography-examples.tsx` - Visual reference
- `frontend/src/components/ui/money.tsx` - Example of DataValue composition
