import { HardHat } from "lucide-react";

import { ConstructionProjects } from "@/components/dashboard/construction-projects";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useProjects } from "@/hooks/useProjects";

interface ConstructionProjectsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Dialog displaying ongoing construction projects with progress tracking. Shows
 * the same content as the dashboard construction section.
 */
export function ConstructionProjectsDialog({
    isOpen,
    onClose,
}: ConstructionProjectsDialogProps) {
    const { data: projectsData } = useProjects();

    const hasConstructionProjects =
        (projectsData?.construction_queue.length ?? 0) > 0;

    // Don't render if there are no projects (shouldn't happen if button logic is correct)
    if (!hasConstructionProjects) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <HardHat className="w-6 h-6" />
                        Under Construction
                    </DialogTitle>
                    <DialogDescription>
                        View ongoing construction projects and their progress.
                    </DialogDescription>
                </DialogHeader>
                <ConstructionProjects showActions={true} />
            </DialogContent>
        </Dialog>
    );
}
