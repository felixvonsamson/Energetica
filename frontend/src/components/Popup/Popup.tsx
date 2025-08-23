import { useState } from "react";

import styles from "./Popup.module.css";

export default function Popup(
    {
        children,
        triggerLabel = "Open Popup"
    }: {
        children: React.ReactNode;
        triggerLabel?: string
    }
) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Trigger */}
            <button
                onClick={() => setIsOpen(true)}
                className={styles['trigger-button']}
            >
                {triggerLabel}
            </button>

            {isOpen && (
                <div className={styles['popup-backdrop']}>
                    <div
                        className={styles['popup-container']}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Always has a dismiss button */}
                            <div
                                onClick={() => setIsOpen(false)}
                                className={styles['popup-close-button']}
                            >
                                &times;
                            </div>
                            {/* Custom content from parent */}
                            <div className="mb-4">{children}</div>

                        </div>
                    </div>
                </div>
            )
            }
        </>
    );
}