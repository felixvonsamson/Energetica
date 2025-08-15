import { apiFetch } from "../client";
import { ChangePasswordRequest } from "./auth.types";

export async function changePassword(data: ChangePasswordRequest): Promise<void> {
    return apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(data)
    })
}