# Frontend Style Guide

## Import Organization

Imports are automatically sorted by ESLint's `import/order` rule. The sort order is:

1. **Builtin** - Node.js built-in modules
2. **External** - Third-party packages
3. **Internal** - Absolute imports from your own project
4. **Parent** - Relative imports from parent directories (`../`)
5. **Sibling** - Relative imports from same directory (`.`)
6. **Index** - Imports from index files

Imports within each group are sorted **alphabetically** (case-insensitive) with a blank line between groups.

### Example

```typescript
import fs from "fs";

import { useQuery } from "@tanstack/react-query";
import { Home } from "lucide-react";

import { API_BASE_URL } from "~/constants";
import { useAuth } from "~/hooks/useAuth";

import { getUser } from "../services/user";

import { Button } from "./Button";
import { Card } from "./Card";
```

Run `npm run lint:check -- --fix` to automatically sort imports, or use "Fix all eslint errors" in VSCode.

### TODO

**Purpose**: Code quality standards & checks

**Content should include**:

-   ESLint rules & why they exist
-   TypeScript strict mode
-   Prettier formatting
-   Pre-commit hooks
-   What must pass before merge
-   How to fix common violations

**Length**: 150-200 lines

**Note**: BEST_PRACTICES.md line 208 has TODO: "Add section about tooling - eslint, prettier"
