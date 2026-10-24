# Error Handling

## Backend error formats

The backend produces three distinct error shapes. The API client in `@energetica/core/api-client` normalises all of them into `ApiClientError`.

**HTTP errors** — most auth and request failures. `detail` is a plain string.

```json
{ "detail": "USERNAME_TAKEN" }
```

**Game errors** and **validation errors** come from two exception handlers that every app installs with `install_error_handlers` (`energetica/kernel/error_envelope.py`). `tests/integration/test_error_envelope_contract.py` pins both shapes and asserts the freeplay, Workshop and lobby apps agree; read it for the exact status codes and body keys.

`ApiClientError.getErrorMessage()` extracts the meaningful string from whichever format arrived.

## Error codes and type safety

Backend error codes are split by who can return them. Each group is an enum that subclasses `ErrorCode`, a `StrEnum` with no codes of its own in `energetica/kernel/game_error.py`:

| Enum                | Module                              | Holds                                                                                           |
| ------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `SharedErrorCode`   | `energetica/kernel/game_error.py`   | Codes every app can return, such as `NOT_AUTHENTICATED`                                         |
| `IdentityErrorCode` | `energetica/identity/game_error.py` | Codes of the join and facilitator routes, which both Instance apps mount and the lobby does not |
| `FreeplayErrorCode` | `energetica/freeplay/game_error.py` | The persistent world's own codes                                                                |
| `WorkshopErrorCode` | `energetica/workshop/game_error.py` | Workshop's own codes                                                                            |
| `LobbyErrorCode`    | `lobby/game_error.py`               | The lobby's own codes                                                                           |

```python
class WorkshopErrorCode(ErrorCode):
    WORKSHOP_SESSION_FINISHED = "WORKSHOP_SESSION_FINISHED"
    # ...
```

Players receive a code's string value, so values are unique across all the enums.

The codes are injected into each OpenAPI schema at generation time (`scripts/generate_openapi_schema.py`), so `bun run generate-types` produces a TypeScript union type. Each app's schema gets the codes that app can return, listed in `APP_ERROR_CODES`: the freeplay and Workshop schemas get the kernel's, the identity layer's and their own, and the lobby's gets the kernel's and its own. The schema is always called `ErrorCode`. The merged schema behind `api.generated.ts` gets every code, until the merged schema itself is removed (#1183). The frontend consumes it via `ApiSchema<"ErrorCode">`, re-exported as `ErrorCode` from `lib/game-messages.ts`.

This creates a closed loop:

- `GAME_ERROR_MESSAGES: Record<ErrorCode, string>` — compile error if any code is missing a message, or if a non-existent code is used as a key.
- `isErrorType(error, errorType: ErrorCode)` — compile error at every call site using an unknown code.

When adding a new backend error: add it to the enum of the layer or app that raises it, run `generate-types`, then add the corresponding entry to `GAME_ERROR_MESSAGES`. The compiler will tell you if you miss either step.

A `GameError` is answered with a 400 unless its class sets another `status_code`, such as 404 for something that does not exist. The body is the same either way.

Workshop's errors subclass `WorkshopError` (`energetica/workshop/game_error.py`), a `GameError` whose subclasses each name their code, such as `RoundLockedError` with `WORKSHOP_ROUND_LOCKED`. The session raises them with a message for logs and tests, and routes let them through: the error envelope sends the code, so a route needs no `except` clause to convert them.

Note that `HTTPException`-based errors (`USERNAME_TAKEN`, `USER_NOT_FOUND`, etc.) are included in these enums even though they don't go through the `GameError` handler — the enums serve as the registry of all error codes.

`tests/integration/test_error_envelope_contract.py` pins which enums each app's schema gets, and fails if a Workshop code reaches the kernel or another app's schema.

## Utilities

**`lib/game-messages.ts`**

- `GAME_ERROR_MESSAGES` — typed map from error code to display string.
- `PYDANTIC_VALIDATION_MESSAGES` — untyped partial-match map for Pydantic error prefixes (`"String should have at least"`, etc.). These are framework-level messages, not game codes.
- `resolveErrorMessage(error)` — resolves an error to a display string, checking `GAME_ERROR_MESSAGES` first, then `PYDANTIC_VALIDATION_MESSAGES` by prefix.
- `formatCancelProjectError(error)` — specialised formatter for `HasDependents` errors, which include structured `kwargs` (dependent project names).

**`lib/error-utils.ts`**

- `getUserFriendlyError(error)` — exact-match lookup in `GAME_ERROR_MESSAGES`, falls back to the raw error message. Use in form `catch` blocks.
- `handleApiError(error, fallback?)` — same as above, but also logs to the console. Use in mutation `onError` handlers or anywhere logging is appropriate.
- `isErrorType(error, code: ErrorCode)` — exact match against `error.getErrorMessage()`. Use to branch on specific codes.
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

Some field errors warrant a banner anyway when they carry meaningful context beyond "this field is wrong" — for example, `USER_NOT_FOUND` on login shows the server restart date, which explains _why_ the account doesn't exist.

Clear all error state at the top of the submit handler, before validation.

## Adding a new error code

1. Add the value to the enum of the layer or app that raises it (see the table above). Use `SCREAMING_CASE` for the string value. Only codes every app can return go in the kernel's `SharedErrorCode`.
2. Raise it from the appropriate backend route via `HTTPException` (to preserve a meaningful HTTP status code) or `GameError` (for business logic errors where 400 is acceptable).
3. Run `bun run generate-types`.
4. Add an entry to `GAME_ERROR_MESSAGES` in `frontend/src/lib/game-messages.ts` — the compiler will flag the missing key.
5. If the error needs specific UI treatment in a form, use `isErrorType` at the call site.
