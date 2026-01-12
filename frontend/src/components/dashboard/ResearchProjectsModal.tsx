import { Microscope } from "lucide-react";

import { ResearchProjects } from "@/components/dashboard/ResearchProjects";
import { Modal } from "@/components/ui";
import { useProjects } from "@/hooks/useProjects";

interface ResearchProjectsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Modal displaying ongoing research projects with progress tracking. Shows the
 * same content as the dashboard research section.
 */
export function ResearchProjectsModal({
    isOpen,
    onClose,
}: ResearchProjectsModalProps) {
    const { data: projectsData } = useProjects();

    const hasResearchProjects = (projectsData?.research_queue?.length ?? 0) > 0;

    // Don't render if there are no projects (shouldn't happen if button logic is correct)
    if (!hasResearchProjects) {
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
                    <Microscope className="w-6 h-6" />
                    Under Research
                </h2>
                <ResearchProjects showActions={true} />
            </div>
        </Modal>
    );
}
