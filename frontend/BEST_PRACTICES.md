# React Best Practices

Standards and patterns for the React migration.

**Quick Links:**
- [STYLING.md](STYLING.md) - Tailwind patterns and theme colors
- [ANIMATIONS.md](ANIMATIONS.md) - Animation and transition guidelines
- [ASSET_COLORS.md](ASSET_COLORS.md) - Asset-specific color system

## Project Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI primitives (Card, Button, Modal)
│   ├── layout/          # Layout components (TopBar, Navigation, GameLayout)
│   ├── features/        # Feature-specific components (Dashboard, Facilities)
│   └── auth/            # Auth-related components
├── hooks/               # Custom React hooks
│   └── use*.ts          # One hook per file, prefixed with 'use'
├── lib/                 # Utilities and configs
│   ├── *-api.ts         # API client modules
│   ├── query-client.ts  # TanStack Query config
│   └── utils.ts         # Utility functions
├── contexts/            # React contexts
├── types/               # TypeScript types
└── routes/              # TanStack Router routes
    └── app/             # Game routes under /app/*
```

## Component Guidelines

### File Naming

- Components: `PascalCase.tsx` (e.g., `DashboardCard.tsx`)
- Hooks: `use*.ts` (e.g., `usePlayerMoney.ts`)
- Utils: `camelCase.ts` (e.g., `formatCurrency.ts`)
- Types: `types.ts` or `*.types.ts`

### Component Structure

```typescript
// 1. Imports
import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// 2. Types
interface CardProps {
    title: string;
    children: ReactNode;
    variant?: "default" | "warning" | "success";
    className?: string;
}

// 3. Component
export function Card({
    title,
    children,
    variant = "default",
    className,
}: CardProps) {
    return (
        <div className={cn("bg-bone p-6 rounded-lg", className)}>
            <h2 className="text-2xl font-bold mb-4">{title}</h2>
            {children}
        </div>
    );
}
```

### Component Organization

**Small, focused components:**

- One responsibility per component
- Extract to separate files when >150 lines
- Use composition over props drilling

**Example:**

```typescript
// Bad - one large component
function Dashboard() {
    return (
        <div>
            {/* 500 lines of mixed concerns */}
        </div>
    );
}

// Good - composed from smaller components
function Dashboard() {
    return (
        <div>
            <WeatherSection />
            <ConstructionSection />
            <QuickLinks />
            <DailyQuiz />
        </div>
    );
}
```

## Styling

For comprehensive styling guidelines, see:
- **[STYLING.md](STYLING.md)** - Tailwind patterns, theme colors, responsive design
- **[ANIMATIONS.md](ANIMATIONS.md)** - Animation and transition best practices
- **[ASSET_COLORS.md](ASSET_COLORS.md)** - Asset-specific color system

### Quick Reference

**Theme colors:** Use `bone`, `tan-green`, `brand-green`, `pine` from tailwind.config
**Icons:** Use `lucide-react` for all icons
**Responsive:** Mobile-first with `md:` and `lg:` breakpoints
**Dark mode:** Always include `dark:` variants
**Animations:** Use `transition-colors duration-150` for hovers, see [ANIMATIONS.md](ANIMATIONS.md)

## State Management

### Local State

Use `useState` for component-local state:

```typescript
const [isOpen, setIsOpen] = useState(false);
```

### Server State

Use TanStack Query for server data:

```typescript
// Create custom hook
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

Use React Context for app-wide state:

```typescript
// contexts/FeatureFlagContext.tsx
const FeatureFlagContext = createContext<FeatureFlags|undefined>(undefined);

export function FeatureFlagProvider({ children }) {
    const [flags, setFlags] = useState<FeatureFlags>({});
    return (
        <FeatureFlagContext.Provider value={{ flags, setFlags }}>
            {children}
        </FeatureFlagContext.Provider>
    );
}

export function useFeatureFlags() {
    const context = useContext(FeatureFlagContext);
    if (!context) throw new Error("Missing FeatureFlagProvider");
    return context;
}
```

## TypeScript

### Prefer Interfaces for Props

```typescript
interface CardProps {
    title: string;
    children: ReactNode;
    onClick?: () => void;
}
```

### Use Type Inference

```typescript
// Good - inferred
const [count, setCount] = useState(0);

// Unnecessary - explicit
const [count, setCount] = useState<number>(0);
```

### Type API Responses

Use generated types from OpenAPI:

```typescript
import type { ApiResponse } from "@/types/api-helpers";

type Player = ApiResponse<"/api/v1/players/me", "get">;

const { data } = useQuery<Player>({
    queryKey: queryKeys.players.me,
    queryFn: playerApi.getMe,
});
```

## Performance

### Avoid Inline Functions in JSX

```typescript
// Bad - creates new function on every render
<button onClick={() => handleClick(id)}>

// Good - memoize if needed
const handleClickMemo = useCallback(() => {
    handleClick(id);
}, [id]);

<button onClick={handleClickMemo}>
```

### Use React.memo for Expensive Components

```typescript
export const ExpensiveList = memo(function ExpensiveList({ items }) {
    return (
        <div>
            {items.map(item => <ExpensiveItem key={item.id} item={item} />)}
        </div>
    );
});
```

### Lazy Load Routes

```typescript
// TanStack Router handles this automatically with code splitting
export const Route = createFileRoute("/app/heavy-page")({
    component: HeavyPage,
    // Automatically code-split
});
```

## Error Handling

### Use Error Boundaries

```typescript
<QueryErrorBoundary>
    <YourComponent />
</QueryErrorBoundary>
```

### Handle Loading States

```typescript
const { data, isLoading, error } = useQuery(...);

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorDisplay error={error} />;
if (!data) return null;

return <DataDisplay data={data} />;
```

## Accessibility

### Semantic HTML

```typescript
// Good
<nav>
    <a href="/dashboard">Dashboard</a>
</nav>

// Bad
<div onClick={navigate}>Dashboard</div>
```

### ARIA Labels

```typescript
<button
    onClick={onClose}
    aria-label="Close modal"
>
    <X className="w-5 h-5" />
</button>
```

### Keyboard Navigation

```typescript
<div
    role="button"
    tabIndex={0}
    onClick={handleClick}
    onKeyDown={(e) => e.key === "Enter" && handleClick()}
>
```

## Testing Considerations

### Write Testable Components

```typescript
// Testable - pure, predictable
export function formatCurrency(amount: number) {
    return `$${amount.toFixed(2)}`;
}

// Harder to test - side effects
export function CurrencyDisplay() {
    const amount = fetchAmount(); // Side effect
    return <div>${amount}</div>;
}

// Better - inject dependencies
export function CurrencyDisplay({ amount }: { amount: number }) {
    return <div>{formatCurrency(amount)}</div>;
}
```

### Use Data Attributes for Testing

```typescript
<button data-testid="submit-button">
    Submit
</button>
```

## Common Patterns

### Conditional Rendering

```typescript
// Boolean
{isLoading && <Spinner />}

// Ternary
{isError ? <Error /> : <Success />}

// Null coalescing
{data?.name ?? "Unknown"}
```

### Lists with Keys

```typescript
{items.map(item => (
    <Card key={item.id} data={item} />
))}
```

### Forms

```typescript
function LoginForm() {
    const [email, setEmail] = useState("");
    const mutation = useLogin();

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        mutation.mutate({ email });
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Loading..." : "Login"}
            </button>
        </form>
    );
}
```

## Anti-Patterns to Avoid

### Don't Mutate State

```typescript
// Bad
const handleAdd = () => {
    items.push(newItem);
    setItems(items);
};

// Good
const handleAdd = () => {
    setItems([...items, newItem]);
};
```

### Don't Use Index as Key

```typescript
// Bad
{items.map((item, index) => <div key={index}>{item}</div>)}

// Good
{items.map(item => <div key={item.id}>{item}</div>)}
```

### Don't Forget Cleanup

```typescript
useEffect(() => {
    const subscription = subscribe();

    // Cleanup function
    return () => {
        subscription.unsubscribe();
    };
}, []);
```

## Code Style

### Import Order

```typescript
// 1. React
import { useState, useEffect } from "react";

// 2. External libraries
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

// 3. Internal - absolute imports with @
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";

// 4. Types
import type { Player } from "@/types/api";
```

### Naming Conventions

- Components: `PascalCase`
- Hooks: `useCamelCase`
- Utils: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Types/Interfaces: `PascalCase`

## Documentation

### Component Documentation

```typescript
/**
 * Displays player's current money with real-time updates.
 *
 * @example
 * <MoneyDisplay />
 *
 * @remarks
 * Automatically subscribes to Socket.IO money updates.
 * Uses tick-based refetching for resilience.
 */
export function MoneyDisplay() {
    // ...
}
```

### Inline Comments

Use comments for "why", not "what":

```typescript
// Good - explains why
// Debounce to avoid excessive API calls during typing
const debouncedSearch = useDebouncedValue(searchQuery, 300);

// Bad - explains what (obvious from code)
// Set the loading state to true
setIsLoading(true);
```

## Summary Checklist

Before submitting a PR:

- [ ] Components are small and focused (<150 lines)
- [ ] Using Tailwind theme colors, not hardcoded hex (see [STYLING.md](STYLING.md))
- [ ] Using lucide-react icons, not emojis
- [ ] Animations follow guidelines (see [ANIMATIONS.md](ANIMATIONS.md))
- [ ] TypeScript types defined for all props
- [ ] Error and loading states handled
- [ ] No console.log statements (use proper logging)
- [ ] Accessibility attributes where needed
- [ ] Responsive design tested
- [ ] No obvious performance issues
- [ ] Follows established patterns from this guide

## See Also

- [STYLING.md](STYLING.md) - Tailwind patterns and theme colors
- [ANIMATIONS.md](ANIMATIONS.md) - Animation and transition guidelines
- [ASSET_COLORS.md](ASSET_COLORS.md) - Asset-specific color system
- [API.md](API.md) - API integration and query patterns
- [FRONTEND.md](FRONTEND.md) - Foundation and architecture overview
