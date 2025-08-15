type GameExceptionType = ""

export class GameError extends Error {
    exception_type: GameExceptionType

    constructor(exception_type: GameExceptionType) {
        super()
        this.exception_type = exception_type
    }
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`/api/v1${url}`, {
        headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
    });

    if (!res.ok) {
        console.error(`url: ${url}`)
        if (res.status === 422) {
            throw new Error(`Received an input validation error, but this is 
                not yet handled properly in api/client.ts.`)
        }
        if (res.status === 400) {
            throw new Error(`Received a GameError error, but this is 
                not yet handled properly in api/client.ts.`)
        }
        throw new Error("Unknown unhandled exception in api/client.ts")
    }

    return res.json() as Promise<T>
}