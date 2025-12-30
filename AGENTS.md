# AGENTS.md - AI Coding Agent Guidelines

## Tech Stack

- **Frontend**: React 19, TanStack Router/Start (SSR/SPA hybrid)
- **Backend**: Convex (serverless, real-time database)
- **Auth**: Clerk
- **Styling**: Tailwind CSS v4, shadcn/ui (base-ui primitives)
- **Forms**: TanStack Form with Zod v4 validation
- **State**: TanStack Query (server), Zustand (client)
- **Package Manager**: Bun

## Build/Lint/Test Commands

```bash
bun run dev        # Start dev server on port 3000
bun run build      # Production build
bun run test       # Run all tests (vitest)
bun run lint       # Run ESLint
bun run format     # Format with Prettier
bun run check      # Format + lint fix combined
bun run component <name>  # Add shadcn component
```

### Running a Single Test

```bash
bun --bun vitest run path/to/test.test.ts           # Run specific test file
bun --bun vitest run -t "test name pattern"          # Run tests matching pattern
bun --bun vitest run path/to/file.test.ts -t "name"  # Combine both
```

## Post-Edit Checklist

**Always run after making changes:**

1. `bun run lint` - Ensure no ESLint errors
2. `bun run format` - Format code with Prettier

## Code Style

- **Print width**: 100 characters
- **TypeScript**: Strict mode, no unused locals/parameters
- **Path alias**: `@/*` maps to `./src/*`

### Import Order

```tsx
// 1. External libraries
import { useState } from "react";
import { Loader2 } from "lucide-react";

// 2. TanStack imports
import { createFileRoute } from "@tanstack/react-router";

// 3. Convex generated (relative paths)
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

// 4. Path alias imports (@/)
import { Button } from "@/components/ui/button";

// 5. Relative imports (feature-local)
import { useAddJob } from "../hooks/useAddJob";
```

Use `import type` for type-only imports.

## Naming Conventions

| Type             | Convention               | Example                           |
| ---------------- | ------------------------ | --------------------------------- |
| Components       | PascalCase               | `JobCard.tsx`, `AddJobModal.tsx`  |
| Hooks            | camelCase + `use` prefix | `useAddJob.ts`                    |
| Routes           | kebab-case               | `jobs.tsx`, `form.address.tsx`    |
| UI primitives    | kebab-case               | `button.tsx`, `dropdown-menu.tsx` |
| Utilities        | camelCase                | `utils.ts`, `pdf.ts`              |
| Convex functions | camelCase                | `jobs.ts`, `jobActions.ts`        |

- Variables/functions: `camelCase`
- Event handlers: `handle` prefix (`handleSubmit`)
- Booleans: `is`/`has` prefix (`isLoading`)
- Props interfaces: `ComponentNameProps`
- Convex types: `Doc<"tableName">`, `Id<"tableName">`

## Component Structure

```tsx
interface ComponentProps {
  jobId: Id<"jobs">;
}

export function Component({ jobId }: ComponentProps) {
  // 1. Hooks first
  const [state, setState] = useState();
  const data = useQuery(api.jobs.get, { id: jobId });

  // 2. Derived values
  const isReady = data && !data.isProcessing;

  // 3. Handlers
  const handleClick = () => {
    /* ... */
  };

  // 4. Early returns
  if (!data) return null;

  // 5. Render
  return <div>...</div>;
}
```

## Error Handling

```tsx
// Client-side
try {
  await mutation({ id });
  toast.success("Job deleted");
} catch (error) {
  console.error("Delete failed:", error);
  toast.error("Failed to delete", {
    description: error instanceof Error ? error.message : "Unknown error",
  });
}

// Convex server-side
if (!job || job.userId !== userId) {
  throw new Error("Job not found or unauthorized");
}
```

## Convex Schema Guidelines

- System fields `_id` and `_creationTime` are auto-generated
- Do NOT add indices for system fields
- Use validators: `v.string()`, `v.id("tableName")`, `v.optional()`, `v.union()`

```ts
export default defineSchema({
  jobs: defineTable({
    userId: v.id("users"),
    title: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed")),
  }).index("userId", ["userId"]),
});
```

## Directory Structure

```
src/
  components/ui/    # shadcn/ui primitives
  components/       # Shared components
  features/         # Feature modules (jobs/components/, jobs/hooks/)
  hooks/            # Shared custom hooks
  integrations/     # Third-party providers (clerk/, convex/, tanstack-query/)
  lib/              # Utilities (utils.ts, theme.tsx)
  routes/           # TanStack Router file-based routes
  server/           # Server functions

convex/
  _generated/       # Auto-generated (DO NOT EDIT)
  lib/              # Shared Convex utilities
  schema.ts         # Database schema
  *.ts              # Convex functions
```

## Styling

- Use Tailwind CSS classes inline
- Use `cn()` from `@/lib/utils` for conditional classes
- Color tokens: `bg-primary`, `text-muted-foreground`, `border-border`

```tsx
<div className={cn("rounded-xl p-4", isActive && "bg-primary")}>
```
