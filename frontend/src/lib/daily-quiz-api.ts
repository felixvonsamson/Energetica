/**
 * Daily Quiz API calls.
 */

import { apiClient } from "./api-client";
import type { ApiResponse, ApiRequestBody } from "@/types/api-helpers";

export const dailyQuizApi = {
    /**
     * Get today's daily quiz question.
     */
    getToday: () =>
        apiClient.get<ApiResponse<"/api/v1/daily-quiz", "get">>("/daily-quiz"),

    /**
     * Submit an answer to today's daily quiz.
     */
    submitAnswer: (data: ApiRequestBody<"/api/v1/daily-quiz", "post">) =>
        apiClient.post<ApiResponse<"/api/v1/daily-quiz", "post">>(
            "/daily-quiz",
            data,
        ),
};
