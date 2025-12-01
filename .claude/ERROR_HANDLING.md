# Error Handling Guide

This document describes the error handling patterns and best practices for the Energetica frontend.

## Table of Contents

- [Overview](#overview)
- [Error Types](#error-types)
- [Core Utilities](#core-utilities)
- [Common Patterns](#common-patterns)
- [Best Practices](#best-practices)
- [Future Roadmap](#future-roadmap)
- [Examples](#examples)

---

## Overview

The frontend uses a **centralized error handling system** that:

- ✅ Provides type-safe error handling with TypeScript
- ✅ Maps backend errors to user-friendly messages
- ✅ Logs errors for debugging and monitoring
- ✅ Handles different backend error formats consistently
- ✅ Makes error handling code cleaner and more maintainable

### Key Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/api-client.ts` | API client with typed error classes and type guards |
| `frontend/src/lib/error-utils.ts` | Centralized error utilities and message mappings |

---

## Error Types

The backend can return three different error formats. Our API client handles all of them:

### 1. HTTP Errors (Standard)

Used for most authentication and request errors.

**Backend Response:**
```json
{
  "detail": "User not found"
}
```

**Status Codes:** 401, 403, 404, 409, etc.

### 2. Game Errors

Used for game-specific validation and business logic errors.

**Backend Response:**
```json
{
  "game_exception_type": "Not enough money",
  "kwargs": { "required": 1000, "available": 500 }
}
```

**Status Code:** 400

### 3. Validation Errors

Used when request data fails Pydantic schema validation.

**Backend Response:**
```json
{
  "detail": [
    {
      "loc": ["body", "username"],
      "msg": "String should have at least 3 characters",
      "type": "string_too_short"
    }
  ],
  "meta": { "error_type": "request_validation_error" }
}
```

**Status Code:** 422

---

## Core Utilities

### ApiClientError Class

Located in `frontend/src/lib/api-client.ts`

```typescript
import { ApiClientError } from '@/lib/api-client';

// Properties
error.status       // HTTP status code
error.message      // Error message
error.detail       // Typed error response from backend

// Methods
error.getErrorMessage()  // Extract user-friendly message from any error format
```

### Type Guards

Use these to narrow error types for specific handling:

```typescript
import { isHttpError, isGameError, isValidationError } from '@/lib/api-client';

if (isHttpError(error.detail)) {
  console.log(error.detail.detail); // string
}

if (isGameError(error.detail)) {
  console.log(error.detail.game_exception_type); // string
  console.log(error.detail.kwargs); // optional object
}

if (isValidationError(error.detail)) {
  console.log(error.detail.detail); // array of validation errors
}
```

### Error Utility Functions

Located in `frontend/src/lib/error-utils.ts`

#### `getUserFriendlyError(error)`

Converts any error to a user-friendly message using the centralized mapping.

```typescript
import { getUserFriendlyError } from '@/lib/error-utils';

try {
  await apiClient.post('/endpoint', data);
} catch (error) {
  const message = getUserFriendlyError(error);
  setError(message); // "This username is already taken. Please choose another."
}
```

#### `handleApiError(error, fallback?)`

Same as `getUserFriendlyError` but also logs the error for debugging.

```typescript
import { handleApiError } from '@/lib/error-utils';

try {
  await apiClient.post('/endpoint', data);
} catch (error) {
  const message = handleApiError(error, 'Failed to save data');
  setError(message);
}
```

#### `isErrorType(error, errorType)`

Check if an error matches a specific backend error message.

```typescript
import { isErrorType } from '@/lib/error-utils';

if (isErrorType(error, 'username is taken')) {
  // Show username suggestions
}
```

#### `isAuthError(error)`

Check if an error is authentication-related.

```typescript
import { isAuthError } from '@/lib/error-utils';

if (isAuthError(error)) {
  navigate({ to: '/login' });
}
```

#### `getValidationFieldErrors(error)`

Extract field-specific errors from validation errors.

```typescript
import { getValidationFieldErrors } from '@/lib/error-utils';

const fieldErrors = getValidationFieldErrors(error);
if (fieldErrors) {
  setFieldError('username', fieldErrors.username);
  setFieldError('password', fieldErrors.password);
}
```

---

## Common Patterns

### Pattern 1: Simple Error Handling (Recommended)

**Use this for most cases:**

```typescript
import { handleApiError } from '@/lib/error-utils';

try {
  await apiClient.post('/endpoint', data);
  // Success handling
} catch (error) {
  const message = handleApiError(error, 'Operation failed');
  setError(message);
}
```

**Benefits:**
- One line of error handling code
- Automatic user-friendly messages
- Error logging included
- Fallback message for unknowns

### Pattern 2: Custom Handling for Specific Errors

**Use when you need special behavior for certain errors:**

```typescript
import { handleApiError, isErrorType } from '@/lib/error-utils';

try {
  await apiClient.post('/endpoint', data);
} catch (error) {
  // Special handling for specific error
  if (isErrorType(error, 'locationOccupied')) {
    showLocationPicker();
    return;
  }

  // Default handling for all other errors
  const message = handleApiError(error);
  setError(message);
}
```

### Pattern 3: Multiple Specific Error Cases

**Use when you need different UX for different errors:**

```typescript
import { isErrorType, handleApiError } from '@/lib/error-utils';

try {
  await apiClient.post('/endpoint', data);
} catch (error) {
  if (isErrorType(error, 'Not enough money')) {
    openPurchaseDialog();
  } else if (isErrorType(error, 'Requirements not satisfied')) {
    showRequirementsModal();
  } else {
    const message = handleApiError(error);
    setError(message);
  }
}
```

### Pattern 4: Form Validation Errors

**Use for forms with field-level validation:**

```typescript
import { getValidationFieldErrors, handleApiError } from '@/lib/error-utils';

try {
  await apiClient.post('/endpoint', formData);
} catch (error) {
  const fieldErrors = getValidationFieldErrors(error);

  if (fieldErrors) {
    // Set field-specific errors
    Object.entries(fieldErrors).forEach(([field, message]) => {
      setFieldError(field, message);
    });
  } else {
    // Generic error
    const message = handleApiError(error);
    setError(message);
  }
}
```

---

## Best Practices

### DO ✅

1. **Use `handleApiError()` for most cases**
   ```typescript
   const message = handleApiError(error);
   setError(message);
   ```

2. **Add new error mappings to `error-utils.ts`**
   ```typescript
   const ERROR_MESSAGES: Record<string, string> = {
     "Backend message": "User-friendly message",
   };
   ```

3. **Use `isErrorType()` for conditional logic**
   ```typescript
   if (isErrorType(error, 'username is taken')) {
     // Special handling
   }
   ```

4. **Display errors using `InfoBanner` component**
   ```typescript
   {error && <InfoBanner variant="error">{error}</InfoBanner>}
   ```

5. **Clear errors when retrying**
   ```typescript
   const handleSubmit = () => {
     setError(null); // Clear previous error
     // ... perform action
   };
   ```

### DON'T ❌

1. **Don't use `alert()` for errors**
   ```typescript
   // ❌ Bad
   alert("Error: " + error.message);

   // ✅ Good
   setError(handleApiError(error));
   ```

2. **Don't hardcode error messages in components**
   ```typescript
   // ❌ Bad
   if (error.detail === "username is taken") {
     setError("This username is already taken");
   }

   // ✅ Good - Add to ERROR_MESSAGES in error-utils.ts instead
   const message = handleApiError(error);
   setError(message);
   ```

3. **Don't access `error.detail` directly without type guards**
   ```typescript
   // ❌ Bad - TypeScript error!
   const msg = error.detail.detail;

   // ✅ Good
   const msg = error.getErrorMessage();
   ```

4. **Don't ignore errors**
   ```typescript
   // ❌ Bad
   try {
     await apiClient.post('/endpoint', data);
   } catch (error) {
     // Silent failure
   }

   // ✅ Good
   try {
     await apiClient.post('/endpoint', data);
   } catch (error) {
     const message = handleApiError(error);
     setError(message);
   }
   ```

5. **Don't show technical error messages to users**
   ```typescript
   // ❌ Bad
   setError(JSON.stringify(error));

   // ✅ Good
   const message = handleApiError(error, 'Something went wrong');
   setError(message);
   ```

---

## Future Roadmap

These improvements are planned but not yet implemented:

### 🎯 TanStack Query Integration

**Goal:** Leverage TanStack Query's built-in error handling for consistent error states.

**When:** Next sprint

**Example:**
```typescript
// Instead of manual try/catch:
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState(null);

// Use TanStack Query mutations:
const mutation = useMutation({
  mutationFn: (data) => apiClient.post('/endpoint', data),
  onError: (error) => {
    const message = handleApiError(error);
    toast.error(message);
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['key']);
    toast.success('Success!');
  },
});

// Usage:
mutation.mutate(formData);
```

**Benefits:**
- Automatic loading states
- Built-in error state management
- Optimistic updates
- Request deduplication
- Automatic retries

**Migration Strategy:**
1. Start with new features using mutations
2. Gradually migrate existing forms
3. Document patterns in this guide

### 🎨 Toast Notification System

**Goal:** Replace mixed `InfoBanner` + `alert()` with consistent toast notifications.

**When:** Future sprint

**Recommended Library:** [Sonner](https://sonner.emilkowal.ski/) - minimal, accessible, beautiful

**Example:**
```typescript
import { toast } from 'sonner';

// Success
toast.success('Project created successfully!');

// Error
toast.error('Failed to save changes');

// With action
toast.error('Connection lost', {
  action: {
    label: 'Retry',
    onClick: () => refetch(),
  },
});

// Promise-based (with automatic states)
toast.promise(
  apiClient.post('/endpoint', data),
  {
    loading: 'Saving...',
    success: 'Saved!',
    error: (err) => handleApiError(err),
  }
);
```

**Migration Strategy:**
1. Install and configure Sonner
2. Update `handleApiError()` to optionally show toasts
3. Replace `alert()` calls first (easy wins)
4. Gradually migrate `InfoBanner` where toasts are more appropriate
5. Keep `InfoBanner` for persistent errors (e.g., form validation)

**When to use what:**
- **Toast:** Temporary feedback (save success, network errors, quick actions)
- **InfoBanner:** Persistent context (form errors, page-level warnings)

---

## Examples

### Example 1: Login Form (Current Implementation)

See `frontend/src/routes/login.tsx:74-92` for reference.

```typescript
import { handleApiError, isErrorType } from '@/lib/error-utils';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setIsLoading(true);

  try {
    await authApi.login({ username, password });
    await refetchAuth();
    navigate({ to: '/app/dashboard' });
  } catch (err) {
    // Special handling for specific error
    if (isErrorType(err, 'User not found')) {
      setError('Custom message with HTML...');
    } else {
      // Default handling
      const message = handleApiError(err, 'Login failed');
      setError(message);
    }
  } finally {
    setIsLoading(false);
  }
};
```

### Example 2: Sign-Up Form (Current Implementation)

See `frontend/src/routes/sign-up.tsx:90-99` for reference.

```typescript
import { handleApiError } from '@/lib/error-utils';

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  // Client-side validation
  if (password !== confirmPassword) {
    setError('Passwords do not match');
    return;
  }

  setIsLoading(true);

  try {
    await authApi.signup({ username, password });
    await refetchAuth();
    navigate({ to: '/app/settle' });
  } catch (err) {
    // Simple one-line error handling
    const message = handleApiError(err, 'Sign-up failed');
    setError(message);
  } finally {
    setIsLoading(false);
  }
};
```

### Example 3: Settlement Page (Needs Migration)

**Current (Bad):**
```typescript
// frontend/src/routes/app/settle.tsx:260
try {
  await mapApi.settleRegion(selectedTile.id);
  await refetchAuth();
  navigate({ to: '/app/dashboard' });
} catch (error) {
  console.error('Error settling location:', error);
  alert('Failed to settle location. Please try again.'); // ❌ Using alert()
  setIsSettling(false);
}
```

**Should be (Good):**
```typescript
import { handleApiError, isErrorType } from '@/lib/error-utils';

try {
  await mapApi.settleRegion(selectedTile.id);
  await refetchAuth();
  navigate({ to: '/app/dashboard' });
} catch (error) {
  // Special handling for occupied location
  if (isErrorType(error, 'locationOccupied')) {
    setError('This location was just claimed by another player.');
  } else {
    const message = handleApiError(error, 'Failed to settle location');
    setError(message);
  }
  setIsSettling(false);
}

// In the JSX:
{error && (
  <InfoBanner variant="error" className="mt-4">
    {error}
  </InfoBanner>
)}
```

### Example 4: Future - With TanStack Query Mutation

**Future implementation pattern:**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { handleApiError } from '@/lib/error-utils';

function SettleForm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const settleMutation = useMutation({
    mutationFn: (tileId: number) => mapApi.settleRegion(tileId),
    onSuccess: async () => {
      // Invalidate relevant queries
      await queryClient.invalidateQueries(['auth']);
      navigate({ to: '/app/dashboard' });
    },
    onError: (error) => {
      const message = handleApiError(error, 'Failed to settle location');
      // With future toast system:
      // toast.error(message);
      setError(message);
    },
  });

  const handleSettle = () => {
    if (!selectedTile) return;
    settleMutation.mutate(selectedTile.id);
  };

  return (
    <button
      onClick={handleSettle}
      disabled={settleMutation.isPending}
    >
      {settleMutation.isPending ? 'Settling...' : 'Choose this location'}
    </button>
  );
}
```

---

## Adding New Error Messages

When you encounter a new backend error message:

1. **Add it to `ERROR_MESSAGES` in `frontend/src/lib/error-utils.ts`**

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  // ... existing messages

  // New error from backend
  "QUOTA_EXCEEDED": "You've reached your quota limit for this action.",
};
```

2. **Test the error flow**
   - Trigger the error condition
   - Verify the user-friendly message displays
   - Check that the error is logged to console

3. **Document special handling (if needed)**
   - If the error requires special UI, add an example to this guide
   - Update relevant component documentation

---

## Debugging Errors

### Console Logging

All errors are logged via `handleApiError()`:

```
API Error: {
  error: ApiClientError { ... },
  userMessage: "This username is already taken",
  timestamp: "2025-12-01T10:30:00.000Z"
}
```

### Finding Error Sources

1. Check console for the full error object
2. Look at `error.detail` to see the raw backend response
3. Check `error.status` for HTTP status code
4. Search backend code for the error message in `energetica/` directory

### Testing Error Messages

To test error handling without triggering real errors:

```typescript
import { ApiClientError } from '@/lib/api-client';
import { handleApiError } from '@/lib/error-utils';

// Simulate an error
const mockError = new ApiClientError(
  'Test error',
  400,
  { detail: 'username is taken' }
);

const message = handleApiError(mockError);
console.log(message); // "This username is already taken. Please choose another."
```

---

## Questions?

- **Where do I add new error messages?** → `frontend/src/lib/error-utils.ts` in `ERROR_MESSAGES`
- **How do I handle errors in forms?** → Use Pattern 1 (Simple Error Handling) from above
- **Should I use `alert()` for errors?** → No, use `InfoBanner` or (future) toast notifications
- **What if I need special handling?** → Use `isErrorType()` to check for specific errors
- **When should I use TanStack Query?** → Not yet - this is a future goal

For more questions or to suggest improvements to this guide, contact the team or create an issue.
