import { MutationObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "./api-client";
import { createQueryClient } from "./query-client";

/** Run one mutation that always fails, and count how often it was sent. */
async function countAttempts(
    options: { retry?: number } = {},
    client = createQueryClient(),
): Promise<number> {
    const mutationFn = vi.fn(() => Promise.reject(new Error("lost")));
    const observer = new MutationObserver(client, {
        mutationFn,
        retryDelay: 0,
        ...options,
    });
    await observer.mutate().catch(() => undefined);
    return mutationFn.mock.calls.length;
}

describe("createQueryClient", () => {
    it("sends a failed mutation once", async () => {
        expect(await countAttempts()).toBe(1);
    });

    it("retries a mutation that opts in", async () => {
        expect(await countAttempts({ retry: 1 })).toBe(2);
    });

    it("reports every failed mutation to onMutationError", async () => {
        const onMutationError = vi.fn();
        await countAttempts({}, createQueryClient({ onMutationError }));
        expect(onMutationError).toHaveBeenCalledOnce();
    });

    it("retries a query after a network error, up to three times", () => {
        const retry = createQueryClient().getDefaultOptions().queries?.retry;
        if (typeof retry !== "function") throw new Error("retry is not a rule");
        const lost = new Error("network");
        expect(retry(0, lost)).toBe(true);
        expect(retry(2, lost)).toBe(true);
        expect(retry(3, lost)).toBe(false);
    });

    it("does not retry a query the server refused", () => {
        const retry = createQueryClient().getDefaultOptions().queries?.retry;
        if (typeof retry !== "function") throw new Error("retry is not a rule");
        expect(retry(0, new ApiClientError("Not found", 404))).toBe(false);
        expect(retry(0, new ApiClientError("Server error", 500))).toBe(true);
    });

    it("lets an app override the query defaults", () => {
        const client = createQueryClient({
            queries: { retry: false, staleTime: 30_000 },
        });
        const queries = client.getDefaultOptions().queries;
        expect(queries?.retry).toBe(false);
        expect(queries?.staleTime).toBe(30_000);
        expect(queries?.refetchOnWindowFocus).toBe(true);
    });
});
