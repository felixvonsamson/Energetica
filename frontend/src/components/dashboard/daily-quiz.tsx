import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDailyQuiz, useSubmitQuizAnswer } from "@/hooks/use-daily-quiz";

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
            return `${baseClass} bg-card border-1 border-border hover:border-brand-green dark:hover:border-brand-green hover:shadow-md text-foreground disabled:opacity-50 disabled:cursor-not-allowed`;
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
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success font-bold">
                    ✓ Your answer
                </span>
            );
        } else if (wasSelected && !isCorrect) {
            return (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive font-bold">
                    ✗ Your answer
                </span>
            );
        } else if (isCorrect) {
            return (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success font-bold">
                    ✓ Correct
                </span>
            );
        }
        return null;
    };

    return (
        <div className="flex justify-center">
            <Card className="max-w-2xl w-full">
                <CardHeader>
                    <CardTitle className="text-center mb-4">
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
                    </CardTitle>
                </CardHeader>

                <CardContent>
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
                                    <button
                                        onClick={() =>
                                            handleAnswerClick("answer1")
                                        }
                                        disabled={hasAnswered || isPending}
                                        className={getButtonClass("answer1")}
                                    >
                                        <span className="block pr-24">
                                            {quizData.answer1}
                                        </span>
                                        {getAnswerIndicator("answer1")}
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleAnswerClick("answer2")
                                        }
                                        disabled={hasAnswered || isPending}
                                        className={getButtonClass("answer2")}
                                    >
                                        <span className="block pr-24">
                                            {quizData.answer2}
                                        </span>
                                        {getAnswerIndicator("answer2")}
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleAnswerClick("answer3")
                                        }
                                        disabled={hasAnswered || isPending}
                                        className={getButtonClass("answer3")}
                                    >
                                        <span className="block pr-24">
                                            {quizData.answer3}
                                        </span>
                                        {getAnswerIndicator("answer3")}
                                    </button>
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
                                                    href={
                                                        quizData.learn_more_link
                                                    }
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
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
