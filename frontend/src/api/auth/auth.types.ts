// Request payload for POST /auth/change-password
export interface ChangePasswordRequest {
    old_password: string
    new_password: string
}