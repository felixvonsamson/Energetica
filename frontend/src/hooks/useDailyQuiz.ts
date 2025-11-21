/**
 * Hooks for daily quiz functionality.
 * The quiz question changes daily and players can answer once per day for XP rewards.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dailyQuizApi } from "@/lib/daily-quiz-api";
import { queryKeys } from "@/lib/query-client";

/**
 * Hook to fetch today's daily quiz question.
 * Returns the question, answers, and whether the player has already answered today.
 */
export function useDailyQuiz() {
    return useQuery({
        queryKey: queryKeys.dailyQuiz.today,
        queryFn: dailyQuizApi.getToday,
        // Quiz data is static for the day, cache for a long time
        staleTime: 60 * 60 * 1000, // 1 hour
        gcTime: 24 * 60 * 60 * 1000, // 24 hours
        // Refetch when window regains focus in case the day changed
        refetchOnWindowFocus: true,
    });
}

/**
 * Hook to submit an answer to today's daily quiz.
 * Returns the updated quiz state with the correct answer revealed.
 */
export function useSubmitQuizAnswer() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (playerAnswer: "answer1" | "answer2" | "answer3") =>
            dailyQuizApi.submitAnswer({ player_answer: playerAnswer }),
        onSuccess: (data) => {
            // Update the cache with the new quiz state (now showing results)
            queryClient.setQueryData(queryKeys.dailyQuiz.today, data);
        },
    });
}
