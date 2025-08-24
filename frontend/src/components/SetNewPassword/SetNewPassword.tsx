import { useState } from "react";
import styles from "./SetNewPassword.module.css";

import { useMutation } from "@tanstack/react-query"
import { changePassword } from "../../api/auth/auth.api";
import { ChangePasswordRequest } from "../../api/auth/auth.types";
import Popup from "../Popup/Popup";
import { showToast } from "../../toast";

export default function SetNewPassword() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("");
    const [verifyPassword, setVerifyPassword] = useState("");

    const mutation = useMutation({
        mutationFn: async (data: ChangePasswordRequest) => changePassword(data),
        onError: (error) => {
            console.error("Query failed:", error);
            // TODO: add toast on error
        },
        onSuccess: (data) => {
            showToast("Password updated successfully", "success");
            setIsOpen(false);
        }
    });

    const handleVerifyChange = (e: { target: { value: any; }; }) => {
        const value = e.target.value;
        setVerifyPassword(value);
    };

    const handleSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        if (newPassword !== verifyPassword) {
            showToast("Passwords do not match", "error");
            return;
        }
        mutation.mutate({ old_password: currentPassword, new_password: newPassword })
    };

    return (
        <Popup isOpen={isOpen} setIsOpen={setIsOpen} triggerLabel="Update password">
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
                    onChange={(e) => setVerifyPassword(e.target.value)}
                    required
                    aria-describedby="verify_error"
                />

                <div className={styles['submit-container']}>
                    <button type="submit">
                        Update password
                    </button>
                </div>
            </form>
        </Popup>
    )
}