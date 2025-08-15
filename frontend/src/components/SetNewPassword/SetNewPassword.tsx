import { useState } from "react";
import styles from "./SetNewPassword.module.css";

import { useMutation } from "@tanstack/react-query"
import { changePassword } from "../../api/auth/auth.api";
import { ChangePasswordRequest } from "../../api/auth/auth.types";

export default function SetNewPassword() {
    const [currentPassword, setCurrentPassword] = useState("password")
    const [newPassword, setNewPassword] = useState("new-password");
    const [verifyPassword, setVerifyPassword] = useState("new-password");
    const [matchError, setMatchError] = useState("");

    const mutation = useMutation({
        mutationFn: async (data: ChangePasswordRequest) => { changePassword(data) }
        // TODO: add toast on error
    });

    const handleVerifyChange = (e: { target: { value: any; }; }) => {
        const value = e.target.value;
        setVerifyPassword(value);

        if (value && value !== newPassword) {
            setMatchError("Passwords do not match");
        } else {
            setMatchError("");
        }
    };

    const handleSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        if (newPassword !== verifyPassword) {
            setMatchError("Passwords do not match");
            return;
        }
        mutation.mutate({ old_password: currentPassword, new_password: newPassword })
    };

    return (
        <form className={styles['set-new-password-container']} onSubmit={handleSubmit}>
            <label htmlFor="old_password">Current password</label>
            <input
                type="password"
                id="old_password"
                name="current-password"
                autoComplete="current-password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
            />

            <label htmlFor="new_password">New password</label>
            <input
                type="password"
                id="new_password"
                name="new-password"
                autoComplete="new-password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
            />

            <label htmlFor="new_password_check">Verify password</label>
            <input
                type="password"
                id="new_password_check"
                name="new-password"
                autoComplete="new-password"
                placeholder="Verify password"
                value={verifyPassword}
                onChange={handleVerifyChange}
                required
                aria-describedby="verify_error"
            />

            {matchError && (
                <p
                    id="verify_error"
                    className={styles.error}
                    role="alert"
                >
                    {matchError}
                </p>
            )
            }

            <div className={styles['submit-container']}>
                <button type="submit">
                    Update password
                </button>
            </div>
        </form>
    )
}