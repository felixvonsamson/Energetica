import { Microscope } from "lucide-react";

import { ResearchProjects } from "@/components/dashboard/research-projects";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useProjects } from "@/hooks/use-projects";

interface ResearchProjectsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Dialog displaying ongoing research projects with progress tracking. Shows the
 * same content as the dashboard research section.
 */
export function ResearchProjectsDialog({
    isOpen,
    onClose,
}: ResearchProjectsDialogProps) {
    const { data: projectsData } = useProjects();

    const hasResearchProjects = (projectsData?.research_queue.length ?? 0) > 0;

    // Don't render if there are no projects (shouldn't happen if button logic is correct)
    if (!hasResearchProjects) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Microscope className="w-6 h-6" />
                        Under Research
                    </DialogTitle>
                    <DialogDescription>
                        View ongoing research projects and their progress.
                    </DialogDescription>
                </DialogHeader>
                <ResearchProjects showActions={true} />
            </DialogContent>
        </Dialog>
    );
}
