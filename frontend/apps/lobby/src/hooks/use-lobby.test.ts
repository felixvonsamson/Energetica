import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { MyRunsResponse } from "@/lib/api/lobby";

import { lobbyQueryKeys, markLoggedOut } from "./use-lobby";

const RUNS = { runs: [] } as unknown as MyRunsResponse;

describe("markLoggedOut", () => {
    it("marks the account logged out", async () => {
        const queryClient = new QueryClient();
        queryClient.setQueryData(lobbyQueryKeys.myRuns, RUNS);

        await markLoggedOut(queryClient);

        expect(queryClient.getQueryData(lobbyQueryKeys.myRuns)).toBeNull();
    });

    it("drops a read of the runs sent before the logout, so it cannot sign the account back in", async () => {
        const queryClient = new QueryClient();
        let answer: (runs: MyRunsResponse) => void = () => {};
        const read = queryClient
            .fetchQuery({
                queryKey: lobbyQueryKeys.myRuns,
                queryFn: () =>
                    new Promise<MyRunsResponse>((resolve) => {
                        answer = resolve;
                    }),
            })
            .catch(() => {});

        await markLoggedOut(queryClient);
        answer(RUNS);
        await read;

        expect(queryClient.getQueryData(lobbyQueryKeys.myRuns)).toBeNull();
    });
});
