import { Truck } from "lucide-react";

import { IncomingShipments } from "@/components/dashboard/incoming-shipments";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useShipments } from "@/hooks/useShipments";

interface IncomingShipmentsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Modal displaying incoming resource shipments with progress tracking. Shows
 * the same content as the dashboard shipments section.
 */
export function IncomingShipmentsModal({
    isOpen,
    onClose,
}: IncomingShipmentsModalProps) {
    const { data: shipmentsData } = useShipments();

    const hasShipments = (shipmentsData?.shipments?.length ?? 0) > 0;

    // Don't render if there are no shipments (shouldn't happen if button logic is correct)
    if (!hasShipments) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Truck className="w-6 h-6" />
                        Incoming Shipments
                    </DialogTitle>
                    <DialogDescription>
                        Track your incoming resource shipments and deliveries.
                    </DialogDescription>
                </DialogHeader>
                <IncomingShipments />
            </DialogContent>
        </Dialog>
    );
}
