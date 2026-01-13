/**
 * Confirmation dialog component for destructive or important actions. Follows
 * the composition pattern from Radix UI / shadcn.
 */

import { useState, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

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

            <Dialog
                open={isOpen}
                onOpenChange={(open) => !open && handleCancel()}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>
                            {typeof description === "string"
                                ? description
                                : null}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Description content */}
                    {typeof description !== "string" && description}

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" disabled={isPending}>
                                {cancelLabel}
                            </Button>
                        </DialogClose>
                        <Button
                            variant={
                                isPending
                                    ? "outline"
                                    : variant === "danger"
                                      ? "destructive"
                                      : "default"
                            }
                            onClick={handleConfirm}
                            disabled={isPending}
                            className="flex items-center gap-2"
                        >
                            {isPending && <Spinner />}
                            {confirmLabel}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
