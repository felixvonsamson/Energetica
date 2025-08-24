type GameExceptionType = "" // TODO: replicate and populate from backend

export class GameError extends Error {
    game_exception_type: GameExceptionType

    constructor(game_exception_type: GameExceptionType) {
        super()
        this.game_exception_type = game_exception_type
    }

    toString() {
        return `GameError (${this.game_exception_type})`;
    }
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`/api/v1${url}`, {
        headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
        ...options
    });

    if (!res.ok) {
        console.error(`url: ${url}`)
        if (res.status === 422) {
            throw new Error("Input validation error (422) — not yet handled");
        }
        if (res.status === 400) {
            const body = await res.json() as { game_exception_type: GameExceptionType }
            console.log(body)
            throw new GameError(body.game_exception_type)
        }
        if (res.status === 401) {
            // TODO: redirect
            throw new Error("Unauthorized (TODO: redirect)")
        }
        throw new Error(`Unhandled HTTP error ${res.status}: ${res.statusText}`);
    }

    if (res.status === 204) return null as unknown as T
    return res.json() as Promise<T>
}