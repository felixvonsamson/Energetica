# React Best Practices

Standards and patterns for the React migration.

**Quick Links:**

-   [styling.md](styling.md) - Tailwind patterns and theme colors
-   [animations.md](animations.md) - Animation and transition guidelines
-   [asset-colours.md](asset-colours.md) - Asset-specific color system

### File Naming

-   Components: `PascalCase.tsx` (e.g., `DashboardCard.tsx`)
-   Hooks: `use*.ts` (e.g., `usePlayerMoney.ts`)
-   Typescript utils: `camelCase.ts` (e.g., `formatCurrency.ts`)

## Component Guidelines

Keep components small and focused where possible.

For components for routes, these can be directly defined in the route. If that component starts to get big, then breaking it up into sub components in that file is fine, e.g. [`@/routes/app/overviews/power.tsx`](/frontend/src/routes/app/overviews/power.tsx). If the route file starts getting too large, consider moving sub components to a feature specific component folder, e.g. [`@/components/chat`](/frontend/src/components/chat).

## Styling

For comprehensive styling guidelines, see:

-   **[styling.md](styling.md)** - Tailwind patterns, theme colors, responsive design
-   **[animations.md](animations.md)** - Animation and transition best practices
-   **[asset-colours.md](asset-colours.md)** - Asset-specific color system

### Quick Reference

**Theme colors:** Use `bone`, `tan-green`, `brand-green`, `pine` from tailwind.config
**Icons:** Use `lucide-react` for all icons
**Responsive:** Mobile-first with `md:` and `lg:` breakpoints
**Dark mode:** Always include `dark:` variants
**Animations:** Use `transition-colors duration-150` for hovers, see [animations.md](animations.md)

## State Management

### Local State

Use `useState` for component-local state:

```ts
const [groupMembers, setGroupMembers] = useState<Player[]>([]);
```

See [`NewGroupChatModal.tsx`](/frontend/src/components/chat/NewGroupChatModal.tsx) for a full example.

### Server State

Use TanStack Query for server data. Custom hooks are located in `@/hooks/` and API clients in `@/lib/api/`:

```ts
// Create custom hook in @/hooks/
export function usePlayerMoney() {
    useTickQuery(queryKeys.players.money);

    return useQuery({
        queryKey: queryKeys.players.money,
        queryFn: playerApi.getMoney,
        staleTime: 60 * 1000,
    });
}

// Use in component
const { data, isLoading, error } = usePlayerMoney();
```

### Global State

Use React Context for app-wide state. See [`ThemeContext.tsx`](/frontend/src/contexts/ThemeContext.tsx) for a real example:

```ts
// @/contexts/ThemeContext.tsx
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(() => {
        const stored = localStorage.getItem("theme") as Theme | null;
        return stored || "light";
    });

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error("useTheme must be used within ThemeProvider");
    return context;
}
```

## TypeScript

### Use Interfaces for Props as Appropriate

```ts
interface CardProps {
    title: string;
    children: ReactNode;
    onClick?: () => void;
}
```

### Use Type Inference

```ts
// Good - inferred
const [count, setCount] = useState(0);

// Unnecessary - explicit
const [count, setCount] = useState<number>(0);
```

### Type API Responses

Use generated types from OpenAPI:

```ts
import type { Requirement } from "@/types/projects";
```

## Accessibility

### Semantic HTML

```ts
// Good
<nav>
    <a href="/dashboard">Dashboard</a>
</nav>

// Bad
<div onClick={navigate}>Dashboard</div>
```

### ARIA Labels

```ts
<button onClick={onClose} aria-label="Close modal">
    <X className="w-5 h-5" />
</button>
```

### Keyboard Navigation

```ts
<div
    role="button"
    tabIndex={0}
    onClick={handleClick}
    onKeyDown={(e) => e.key === "Enter" && handleClick()}
>
```

## Summary Checklist

Before submitting a PR:

-   [ ] Using lucide-react icons, not emojis
-   [ ] Animations follow guidelines (see [animations.md](animations.md))
-   [ ] Responsive design tested

## See Also

-   [styling.md](styling.md) - Tailwind patterns and theme colors
-   [animations.md](animations.md) - Animation and transition guidelines
-   [asset-colours.md](asset-colours.md) - Asset-specific color system
-   [api.md](api.md) - API integration and query patterns
-   [architecture/overview.md](/docs/architecture/overview.md) - Foundation and architecture overview

## TODO

Add section about tooling - eslint, prettier
