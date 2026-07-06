/**
 * Instance auth API.
 *
 * After the lobby cutover (ADR-0002/0003) the instance mints no sessions — the
 * only auth call it makes is `/auth/me`, the entry gate that validates the
 * shared SSO cookie and provisions the local user. Credentials (login / signup
 * / logout / change-password) are the lobby's; they live in `lib/api/lobby.ts`
 * (`lobbyAuthApi`) so they can't be called from a run, where those endpoints no
 * longer exist.
 */

import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api-helpers";

export const authApi = {
    /** Get current authenticated user (the instance entry gate). */
    me: () => apiClient.get<ApiResponse<"/api/v1/auth/me", "get">>("/auth/me"),
};
