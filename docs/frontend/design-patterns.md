# Frontend Iteration Patterns for Design Development

TODO: rename this file to something more apt and descriptive

Quick reference for dummy data and preview patterns when rapidly iterating on frontend designs.

## Quick Iteration with Dummy Data

### URL Query Parameters (Simplest)

Switch between scenarios by changing the URL—no code edits needed.

```ts
// frontend/src/data/dummyFacilities.ts
export const scenarios = {
    "best-case": [{ id: 1, name: "Solar Farm A", capacity: 500 }],
    "worst-case": [{ id: 1, name: "Solar Farm (Degraded)", capacity: 50 }],
    empty: [],
};

// In your component
function YourPage() {
    const params = new URLSearchParams(window.location.search);
    const scenario = params.get("scenario") || "best-case";
    const facilities = scenarios[scenario];
    return <div>{/* render */}</div>;
}
```

Visit: `http://localhost:5173/page?scenario=worst-case`

**Pros:** Zero setup, instant switching, HMR-friendly
**Cons:** Manual URL editing

### Debug Routes (Medium Complexity)

Show all scenarios side-by-side on a dedicated debug page.

```ts
// frontend/src/routes/app/_debug/facilities.tsx
import { scenarios } from "@/data/dummyFacilities";

export function FacilitiesDebug() {
    return (
        <div className="p-8 space-y-8">
            {Object.entries(scenarios).map(([name, data]) => (
                <div key={name} className="border rounded p-4">
                    <h2>{name}</h2>
                    <YourPage facilities={data} />
                </div>
            ))}
        </div>
    );
}
```

Visit: `/app/_debug/facilities` to see all at once.

**Pros:** See all variations simultaneously, still HMR-friendly
**Cons:** Requires route setup

## SwiftUI @Preview Equivalent: Storybook

If you want something more structured and polished:

```ts
// frontend/src/components/YourPage.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import YourPage from "./YourPage";
import { scenarios } from "@/data/dummyFacilities";

const meta = {
    component: YourPage,
    parameters: { layout: "fullscreen" },
} satisfies Meta<typeof YourPage>;

export default meta;

export const BestCase: StoryObj = {
    args: { facilities: scenarios["best-case"] },
};

export const WorstCase: StoryObj = {
    args: { facilities: scenarios["worst-case"] },
};
```

Run: `npx storybook dev`

**Pros:** Polished UI, component-focused, good for documentation
**Cons:** Extra tool, more setup overhead

## Understanding Environment Variables

### `import.meta.env.DEV`

Automatically set by Vite (don't manually configure):

-   `true` when running `npm run dev`
-   `false` when running `npm run build`

### Custom Environment Variables

Create `.env.local` (ignored by git) at project root:

```bash
VITE_SCENARIO=worst-case
```

Access in code: `import.meta.env.VITE_SCENARIO`

## Recommendation for This Project

1. **Short term (now):** Use query parameters - minimal friction
2. **Medium term:** Add debug routes if constantly switching scenarios
3. **Long term:** Storybook if building component library or design system

## Best Practices

-   Keep dummy data organized by feature (`dummyFacilities.ts`, `dummyProjects.ts`, etc.)
-   Use TypeScript types from actual schemas to keep dummy data in sync
-   Create multiple scenarios: best-case, worst-case, edge cases (empty, very long names, etc.)
-   Use HMR advantage: change dummy data, save, see instant result in browser
-   Delete dummy files or wrap in dev checks before shipping to production
