/**
 * Confirmation dialog component for destructive or important actions. Follows
 * the composition pattern from Radix UI / shadcn.
 */

import { useState, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

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
    variant?: "danger" | "default";
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
    variant = "default",
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
                        <Button
                            variant="secondary"
                            onClick={handleCancel}
                            disabled={isPending}
                        >
                            {cancelLabel}
                        </Button>
                        <Button
                            variant={
                                variant === "danger" ? "destructive" : "default"
                            }
                            onClick={handleConfirm}
                            disabled={isPending}
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
