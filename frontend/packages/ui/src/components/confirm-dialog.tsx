/**
 * Confirmation dialog component for destructive or important actions. Follows
 * the composition pattern from Radix UI / shadcn.
 */

import { useState, ReactNode } from "react";

import { Button } from "./button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./dialog";
import { Spinner } from "./spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

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
    /**
     * Why the action can't be confirmed right now. When set, the dialog still
     * opens, so its details can be read, but the confirm button is disabled and
     * shows this reason as a tooltip.
     */
    disabledReason?: string;
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
    disabledReason,
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

    const confirmButton = (
        <Button
            variant={
                isPending
                    ? "outline"
                    : variant === "danger"
                      ? "destructive"
                      : "default"
            }
            onClick={handleConfirm}
            disabled={isPending || !!disabledReason}
            className="flex items-center gap-2"
        >
            {isPending && <Spinner />}
            {confirmLabel}
        </Button>
    );

    return (
        <>
            {/* Clone the trigger and add onClick handler */}
            <div
                role="button"
                tabIndex={0}
                onClick={() => setIsOpen(true)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setIsOpen(true);
                    }
                }}
            >
                {trigger}
            </div>

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
                        {disabledReason ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="inline-flex">
                                        {confirmButton}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {disabledReason}
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            confirmButton
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
