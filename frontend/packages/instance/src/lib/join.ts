/**
 * Pure helpers for the visitor-facing join flow (#1021).
 *
 * A visitor with no SSO session yet must go through the lobby's existing,
 * unmodified login/signup flow before they can confirm joining — but that
 * flow's `?return=` bounce (`lobbyLoginHref` in `@energetica/core/instances`)
 * only ever lands them back on this run's home page, never on the specific join
 * page they started from (the bounce carries a run slug, not an arbitrary path,
 * and is shared with unrelated login flows the switcher/picker also use).
 * `sessionStorage` — scoped to this run's own origin, so it survives the round
 * trip to the lobby's different origin and back, and is cleared when the tab
 * closes rather than lingering forever — is what lets each app's home page
 * notice "there was a join in progress" and send the visitor back to the
 * confirm screen instead of the ordinary role-based landing page. The join card
 * remembers the token; the app's home page takes it back.
 *
 * The storage takes a `Storage` parameter (defaulting to the real
 * `sessionStorage`) rather than reading the global directly, so the round-trip
 * logic is a pure function of its argument and needs no DOM environment to test
 * (Vitest runs in its plain `node` environment).
 */

const PENDING_JOIN_TOKEN_KEY = "energetica.pendingJoinToken";

function defaultStorage(): Storage | undefined {
    return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
}

/**
 * Remember `token` before sending an unauthenticated visitor off to log in or
 * sign up.
 */
export function rememberPendingJoinToken(
    token: string,
    storage: Storage | undefined = defaultStorage(),
): void {
    try {
        storage?.setItem(PENDING_JOIN_TOKEN_KEY, token);
    } catch {
        // Storage can be unavailable (private browsing, disabled) — the visitor simply has to
        // re-click the join link after logging in instead of resuming automatically.
    }
}

/**
 * Read and clear the pending join token, if one was remembered. Consuming it on
 * read means a later, unrelated login in the same tab does not resume a stale
 * join.
 */
export function takePendingJoinToken(
    storage: Storage | undefined = defaultStorage(),
): string | null {
    try {
        const token = storage?.getItem(PENDING_JOIN_TOKEN_KEY) ?? null;
        if (token !== null) storage?.removeItem(PENDING_JOIN_TOKEN_KEY);
        return token;
    } catch {
        return null;
    }
}
