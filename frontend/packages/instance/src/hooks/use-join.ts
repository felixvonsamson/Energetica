/**
 * Hooks for the visitor-facing join flow (#1021): resolving a join token and
 * confirming membership, backing each app's join page.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { joinApi } from "#instance/lib/api/join";
import { instanceQueryKeys } from "#instance/lib/query-keys";

/**
 * What this join link offers: the instance's name, whether it's currently
 * accepting new members, and — if the visitor already has an SSO session —
 * their username.
 */
export function useJoinLink(token: string) {
    return useQuery({
        queryKey: instanceQueryKeys.join.link(token),
        queryFn: () => joinApi.getLink(token),
        // Nothing else in this session writes this instance's join settings; the toggle only
        // ever changes from the facilitator's own page, in a different browser entirely.
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });
}

/**
 * Confirm joining: appends the visitor's username to the instance's allowlist.
 *
 * `onJoined` runs once the server has admitted the visitor, and the mutation
 * stays pending until the promise it returns settles. The app uses it to
 * re-read whatever its entry gate depends on, since that gate now admits this
 * account, and then to take the visitor into the app.
 */
export function useConfirmJoin(
    token: string,
    { onJoined }: { onJoined: () => void | Promise<void> },
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => joinApi.confirm(token),
        onSuccess: async () => {
            void queryClient.invalidateQueries({
                queryKey: instanceQueryKeys.join.link(token),
            });
            await onJoined();
        },
    });
}
