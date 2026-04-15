import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { DailyQuizSection } from "@/components/dashboard/daily-quiz";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/app/dashboard/quiz")({
    component: QuizDialog,
    staticData: {
        title: "Daily Quiz",
        routeConfig: {
            requiredRole: "player",
            requiresSettledTile: true,
            isUnlocked: () => ({ unlocked: true }),
        },
    },
});

function QuizDialog() {
    const navigate = useNavigate();

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    void navigate({ to: "/app/dashboard" });
                }
            }}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-center">
                        <img
                            src="/static/images/icons/quiz.png"
                            className="inline w-6 h-6"
                            alt=""
                        />
                        <span className="mx-2">Daily Quiz</span>
                        <img
                            src="/static/images/icons/quiz.png"
                            className="inline w-6 h-6"
                            alt=""
                        />
                    </DialogTitle>
                </DialogHeader>
                <DailyQuizSection />
            </DialogContent>
        </Dialog>
    );
}
