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
                    <DialogDescription>
                        Important information about chat usage.
                    </DialogDescription>
                </DialogHeader>
                <p>
                    This is a disclaimer that tells you that the chat is not
                    censored and that any message can be read by the
                    administrators.
                </p>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button className="w-full">OK</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
