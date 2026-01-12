import { Truck } from "lucide-react";

import { IncomingShipments } from "@/components/dashboard/IncomingShipments";
import { Modal } from "@/components/ui";
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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title=""
            className="max-w-4xl max-h-[90vh] overflow-y-auto"
        >
            <div className="space-y-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Truck className="w-6 h-6" />
                    Incoming Shipments
                </h2>
                <IncomingShipments />
            </div>
        </Modal>
    );
}
