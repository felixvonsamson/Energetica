import { HardHat } from "lucide-react";

import { ConstructionProjects } from "@/components/dashboard/ConstructionProjects";
import { Modal } from "@/components/ui";
import { useProjects } from "@/hooks/useProjects";

interface ConstructionProjectsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Modal displaying ongoing construction projects with progress tracking. Shows
 * the same content as the dashboard construction section.
 */
export function ConstructionProjectsModal({
    isOpen,
    onClose,
}: ConstructionProjectsModalProps) {
    const { data: projectsData } = useProjects();

    const hasConstructionProjects =
        (projectsData?.construction_queue?.length ?? 0) > 0;

    // Don't render if there are no projects (shouldn't happen if button logic is correct)
    if (!hasConstructionProjects) {
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
                    <HardHat className="w-6 h-6" />
                    Under Construction
                </h2>
                <ConstructionProjects showActions={true} />
            </div>
        </Modal>
    );
}
