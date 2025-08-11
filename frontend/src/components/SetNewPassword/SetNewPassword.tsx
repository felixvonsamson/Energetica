import { useState } from "react";
import styles from "./SetNewPassword.module.css";

export default function SetNewPassword() {
    const [newPassword, setNewPassword] = useState("");
    const [verifyPassword, setVerifyPassword] = useState("");
    const [matchError, setMatchError] = useState("");

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
        // 🔐 Submit to server here
    };

    return (
        <form className={styles['set-new-password-container']}>
            <label htmlFor="old_password">Current password</label>
            <input
                type="password"
                id="old_password"
                name="current-password"
                autoComplete="current-password"
                placeholder="Current password"
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

            <div className={styles['submit-container']}>
                <button type="submit">
                    Update password
                </button>

                {matchError ? (
                    <p
                        id="verify_error"
                        className={styles.error}
                        role="alert"
                    >
                        {matchError}
                    </p>) :
                    (<p>&nbsp</p>)
                }
            </div>
        </form>
    )
}