/**
 * Confirmation dialog component for destructive or important actions. Follows
 * the composition pattern from Radix UI / shadcn.
 */

import { useState, ReactNode } from "react";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
    /** The trigger element (button) that opens the dialog */
    trigger: ReactNode;
    /** Dialog title */
    title: string;
    /** Dialog description/message */
    description: ReactNode;
    /** Label for the confirm button */
    confirmLabel?: string;
    /** Label for the cancel button */
    cancelLabel?: string;
    /** Visual variant for the confirm button */
    variant?: "danger" | "primary";
    /** Callback when user confirms */
    onConfirm: () => void;
    /** Optional callback when dialog closes */
    onCancel?: () => void;
    /** Whether the confirm action is currently pending */
    isPending?: boolean;
}

/**
 * A declarative confirmation dialog that manages its own open/close state.
 *
 * @example
 *     <ConfirmDialog
 *         trigger={<button>Delete All</button>}
 *         title="Confirm Deletion"
 *         description={<p>Delete {count} items?</p>}
 *         variant="danger"
 *         onConfirm={() => deleteMutation.mutate()}
 *         isPending={deleteMutation.isPending}
 *     />;
 */
export function ConfirmDialog({
    trigger,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "primary",
    onConfirm,
    onCancel,
    isPending = false,
}: ConfirmDialogProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleConfirm = () => {
        onConfirm();
        setIsOpen(false);
    };

    const handleCancel = () => {
        setIsOpen(false);
        onCancel?.();
    };

    return (
        <>
            {/* Clone the trigger and add onClick handler */}
            <div onClick={() => setIsOpen(true)}>{trigger}</div>

            <Modal isOpen={isOpen} onClose={handleCancel} title={title}>
                <div className="space-y-4">
                    {/* Description content */}
                    {description}

                    {/* Action buttons */}
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={handleCancel}
                            disabled={isPending}
                            className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white px-4 py-2 rounded font-medium transition-colors disabled:opacity-50"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isPending}
                            className={`px-4 py-2 rounded font-medium transition-colors disabled:opacity-50 ${
                                variant === "danger"
                                    ? "bg-alert-red hover:bg-alert-red/80 text-white"
                                    : "bg-brand-green hover:bg-brand-green/80 text-white"
                            }`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
