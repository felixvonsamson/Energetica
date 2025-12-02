import { Modal } from "@components/ui/Modal";
import { Button } from "@components/ui";

interface ChatDisclaimerModalProps {
    isOpen: boolean;
    onDismiss: () => void;
}

export function ChatDisclaimerModal({
    isOpen,
    onDismiss,
}: ChatDisclaimerModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onDismiss} title="Chat Disclaimer">
            <div className="space-y-4">
                <p>
                    This is a disclaimer that tells you that the chat is not
                    censored and that any message can be read by the
                    administrators.
                </p>
                <Button onClick={onDismiss} className="w-full">
                    OK
                </Button>
            </div>
        </Modal>
    );
}
