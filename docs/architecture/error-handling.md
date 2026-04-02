# Error Handling

## Backend error formats

The backend produces three distinct error shapes. The API client in `lib/api-client.ts` normalises all of them into `ApiClientError`.

**HTTP errors** — most auth and request failures. `detail` is a plain string.
```json
{ "detail": "USERNAME_TAKEN" }
```

**Game errors** — business logic failures from the `GameError` exception handler. Always 400.
```json
{ "game_exception_type": "NOT_ENOUGH_MONEY", "kwargs": { ... } }
```

**Validation errors** — Pydantic schema failures. Always 422.
```json
{ "detail": [{ "loc": ["body", "username"], "msg": "...", "type": "..." }] }
```

`ApiClientError.getErrorMessage()` extracts the meaningful string from whichever format arrived.

## Error codes and type safety

Backend game error codes live in `energetica/game_error.py` as a `StrEnum`:

```python
class GameExceptionType(StrEnum):
    USERNAME_TAKEN = "USERNAME_TAKEN"
    USER_NOT_FOUND = "USER_NOT_FOUND"
    # ...
```

The enum is injected into the OpenAPI schema at generation time (`scripts/generate_openapi_schema.py`), so `bun run generate-types` produces a TypeScript union type. The frontend consumes it via `ApiSchema<"GameExceptionType">`, re-exported as `GameExceptionType` from `lib/game-messages.ts`.

This creates a closed loop:
- `GAME_ERROR_MESSAGES: Record<GameExceptionType, string>` — compile error if any code is missing a message, or if a non-existent code is used as a key.
- `isErrorType(error, errorType: GameExceptionType)` — compile error at every call site using an unknown code.

When adding a new backend error: add it to `GameExceptionType` in Python, run `generate-types`, then add the corresponding entry to `GAME_ERROR_MESSAGES`. The compiler will tell you if you miss either step.

Note that `HTTPException`-based errors (`USERNAME_TAKEN`, `USER_NOT_FOUND`, etc.) are included in `GameExceptionType` even though they don't go through the `GameError` handler — the enum serves as the single registry of all error codes.

## Utilities

**`lib/game-messages.ts`**

- `GAME_ERROR_MESSAGES` — typed map from error code to display string.
- `PYDANTIC_VALIDATION_MESSAGES` — untyped partial-match map for Pydantic error prefixes (`"String should have at least"`, etc.). These are framework-level messages, not game codes.
- `resolveErrorMessage(error)` — resolves an error to a display string, checking `GAME_ERROR_MESSAGES` first, then `PYDANTIC_VALIDATION_MESSAGES` by prefix.
- `formatCancelProjectError(error)` — specialised formatter for `HasDependents` errors, which include structured `kwargs` (dependent project names).

**`lib/error-utils.ts`**

- `getUserFriendlyError(error)` — exact-match lookup in `GAME_ERROR_MESSAGES`, falls back to the raw error message. Use in form `catch` blocks.
- `handleApiError(error, fallback?)` — same as above, but also logs to the console. Use in mutation `onError` handlers or anywhere logging is appropriate.
- `isErrorType(error, code: GameExceptionType)` — exact match against `error.getErrorMessage()`. Use to branch on specific codes.
- `getValidationFieldErrors(error)` — extracts a `Record<string, string>` from a 422 response, keyed by field name. Useful in forms that rely on backend validation for field-level errors.

## TanStack Query patterns

**Mutations** own error behaviour at the call site. Reusable mutation hooks (`useSignup`, `useLogin`, etc.) should not have `onError` handlers — they can't know whether the error should be a toast, a field annotation, or something else. The call site uses `mutateAsync` and handles errors in the `catch` block.

```ts
try {
    await signup.mutateAsync({ username, password });
    await refetchAuth();
    navigate({ to: "/app/settle" });
} catch (err) {
    if (isErrorType(err, "USERNAME_TAKEN")) {
        setUsernameError(getUserFriendlyError(err));
    } else {
        setGeneralError(getUserFriendlyError(err));
    }
}
```

Hooks may use `onSuccess` for data concerns (invalidating query caches), but not for UI side-effects.

**Queries** (`useQuery`) should never produce side-effects on error. Expose `isError` and `error` for components to render what they need. Use error boundaries for failures that should block rendering entirely.

For game actions that produce toast feedback (not form submissions), the toast belongs in the mutation hook's `onError` since the calling code has no persistent UI state to update:

```ts
return useMutation({
    mutationFn: ...,
    onError: (error) => toast.error(resolveErrorMessage(error)),
    onSuccess: () => toast.success("Done"),
});
```

## Form error handling

Errors from form submissions fall into two categories:

**Field-level errors** — the user can fix them by editing a specific input. Show inline, below the field, with `aria-invalid` on the input. Use for server-confirmed conflicts (`USERNAME_TAKEN`) and incorrect credentials (`INVALID_PASSWORD`, `USER_NOT_FOUND`).

**Banner errors** — anything the user can't fix by editing a field: network failures, permission errors, unexpected server errors. `InfoBanner variant="error"` at the top of the form.

Some field errors warrant a banner anyway when they carry meaningful context beyond "this field is wrong" — for example, `USER_NOT_FOUND` on login shows the server restart date, which explains *why* the account doesn't exist.

Clear all error state at the top of the submit handler, before validation.

## Adding a new error code

1. Add the value to `GameExceptionType` in `energetica/game_error.py`. Use `SCREAMING_CASE` for the string value.
2. Raise it from the appropriate backend route via `HTTPException` (to preserve a meaningful HTTP status code) or `GameError` (for business logic errors where 400 is acceptable).
3. Run `bun run generate-types`.
4. Add an entry to `GAME_ERROR_MESSAGES` in `frontend/src/lib/game-messages.ts` — the compiler will flag the missing key.
5. If the error needs specific UI treatment in a form, use `isErrorType` at the call site.
