import { Link } from "@tanstack/react-router";
import { Bell, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TypographyH2, TypographyLarge } from "@/components/ui/typography";
import { useDailyQuiz, useSubmitQuizAnswer } from "@/hooks/use-daily-quiz";
import { getPushPref, setPushPref } from "@/lib/push-notification-prefs";
import { cn } from "@/lib/utils";

export function DailyQuizButton() {
    return (
        <Link
            to="/app/dashboard/quiz"
            className={cn(
                "bg-card hover:bg-muted",
                "p-6 rounded-lg text-center transition-colors block w-full",
                "border border-transparent hover:border-pine dark:hover:border-brand-green",
            )}
        >
            <HelpCircle className="w-8 h-8 mx-auto mb-2 text-foreground" />
            <TypographyH2 className="text-foreground">
                <TypographyLarge>Daily Quiz</TypographyLarge>
            </TypographyH2>
        </Link>
    );
}

function QuizPushToggle() {
    const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
    const [globalPushActive, setGlobalPushActive] = useState<boolean | null>(
        null,
    );

    useEffect(() => {
        // Check if browser push is globally enabled
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
            // No push support — resolved in the next microtask to satisfy lint
            void Promise.resolve().then(() => setGlobalPushActive(false));
            return;
        }
        navigator.serviceWorker.ready
            .then((reg) => reg.pushManager.getSubscription())
            .then((sub) => {
                setGlobalPushActive(!!sub);
                if (sub) {
                    getPushPref("quiz").then(setPushEnabled);
                }
            });
    }, []);

    if (globalPushActive === null) return null;

    if (!globalPushActive) {
        return (
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
                <Bell className="w-4 h-4 shrink-0" />
                <span>
                    Want a reminder when the quiz resets?{" "}
                    <Link
                        to="/app/settings"
                        className="underline hover:text-foreground transition-colors"
                    >
                        Enable browser notifications
                    </Link>
                </span>
            </div>
        );
    }

    if (pushEnabled === null) return null; // still loading pref

    return (
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <Label
                htmlFor="quiz-push-toggle"
                className="flex items-center gap-2 text-sm text-muted-foreground"
            >
                <Bell className="w-4 h-4 shrink-0" />
                Daily quiz reminder
            </Label>
            <Switch
                id="quiz-push-toggle"
                checked={pushEnabled}
                onCheckedChange={(checked) => {
                    setPushEnabled(checked);
                    void setPushPref("quiz", checked);
                }}
            />
        </div>
    );
}

export function DailyQuizSection() {
    // TODO: correctly answering the daily quiz earns the player 1 XP point. This is not communicated in the new UI
    const { data: quizData, isLoading, isError } = useDailyQuiz();
    const { mutate: submitAnswer, isPending } = useSubmitQuizAnswer();

    const handleAnswerClick = (answer: "answer1" | "answer2" | "answer3") => {
        if (!quizData || quizData.player_answer) return; // Already answered
        submitAnswer(answer);
    };

    const hasAnswered =
        quizData?.player_answer !== undefined &&
        quizData.player_answer !== null;

    // Helper to determine if an answer is correct
    const isCorrectAnswer = (answer: "answer1" | "answer2" | "answer3") => {
        if (!quizData?.correct_answer) return false;
        return (
            quizData.correct_answer === answer ||
            quizData.correct_answer === "all correct"
        );
    };

    // Helper to get button styling based on state
    const getButtonClass = (answer: "answer1" | "answer2" | "answer3") => {
        const baseClass =
            "w-full px-4 py-3 rounded-lg font-medium transition-all duration-300 ease-out relative";

        if (!hasAnswered) {
            // Before answering - normal clickable button
            return `${baseClass} bg-card border-1 border-border hover:bg-muted hover:border-brand hover:shadow-md text-foreground disabled:opacity-50 disabled:cursor-not-allowed`;
        }

        // After answering - show feedback
        const isCorrect = isCorrectAnswer(answer);
        const wasSelected = quizData.player_answer === answer;

        if (wasSelected && isCorrect) {
            // User selected correct answer
            return `${baseClass} bg-success/10 border-1 border-success text-success cursor-default`;
        } else if (wasSelected && !isCorrect) {
            // User selected wrong answer
            return `${baseClass} bg-destructive/10 border-1 border-destructive text-destructive cursor-default`;
        } else if (isCorrect) {
            // Correct answer (not selected)
            return `${baseClass} bg-success/10 border-1 border-success text-success cursor-default`;
        } else {
            // Incorrect answer (not selected)
            return `${baseClass} bg-card border-1 border-border text-muted-foreground cursor-default opacity-60`;
        }
    };

    // Helper to render answer icon/indicator
    const getAnswerIndicator = (answer: "answer1" | "answer2" | "answer3") => {
        if (!hasAnswered) return null;

        const isCorrect = isCorrectAnswer(answer);
        const wasSelected = quizData.player_answer === answer;

        if (wasSelected && isCorrect) {
            return (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success font-bold whitespace-nowrap">
                    ✓ Your answer
                </span>
            );
        } else if (wasSelected && !isCorrect) {
            return (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive font-bold whitespace-nowrap">
                    ✗ Your answer
                </span>
            );
        } else if (isCorrect) {
            return (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success font-bold whitespace-nowrap">
                    ✓ Correct
                </span>
            );
        }
        return null;
    };

    return (
        <div className="space-y-4">
            {isLoading ? (
                <div className="text-center text-gray-500">
                    Loading quiz question...
                </div>
            ) : isError ? (
                <div className="text-center text-alert-red">
                    Failed to load quiz question
                </div>
            ) : quizData ? (
                <>
                    {/* Question */}
                    <p className="text-lg text-center mb-4">
                        {quizData.question}
                    </p>

                    {/* Answer Buttons */}
                    <div className="space-y-3">
                        {(["answer1", "answer2", "answer3"] as const).map(
                            (key) => (
                                <button
                                    key={key}
                                    onClick={() => handleAnswerClick(key)}
                                    disabled={hasAnswered || isPending}
                                    className={getButtonClass(key)}
                                >
                                    <span className="block text-center px-28">
                                        {quizData[key]}
                                    </span>
                                    {getAnswerIndicator(key)}
                                </button>
                            ),
                        )}
                    </div>

                    {/* Explanation and Learn More (only shown after answering) */}
                    {hasAnswered && quizData.explanation && (
                        <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                            <p className="text-center mb-3">
                                {quizData.explanation}
                            </p>
                            {quizData.learn_more_link && (
                                <p className="text-center">
                                    <a
                                        href={quizData.learn_more_link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-info underline hover:opacity-80"
                                    >
                                        Learn more
                                    </a>
                                </p>
                            )}
                        </div>
                    )}

                    {/* Submitting state */}
                    {isPending && (
                        <p className="text-center text-gray-500 text-sm">
                            Submitting answer...
                        </p>
                    )}
                </>
            ) : null}

            <QuizPushToggle />
        </div>
    );
}
