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

interface ChatDisclaimerDialogProps {
    isOpen: boolean;
    onDismiss: () => void;
}

export function ChatDisclaimerDialog({
    isOpen,
    onDismiss,
}: ChatDisclaimerDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Chat Disclaimer</DialogTitle>
                    <DialogDescription className="sr-only">
                        Important information about in-game chat usage.
                    </DialogDescription>
                </DialogHeader>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>The in-game chat is not censored</li>
                    <li>All messages can be read by administrators</li>
                </ul>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button className="w-full">I understand</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
