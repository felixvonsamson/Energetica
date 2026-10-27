/**
 * Feedback on the game, at the bottom of the scoreboard once the session is
 * over. Each player rates how fun the game was and how well it taught how the
 * electricity market works, from 1 to 5 stars, and can add a comment. Sending
 * again replaces what they sent before, so the form starts from their last
 * answer.
 */

import { MessageSquareHeart, Star } from "lucide-react";
import { useId, useState } from "react";

import { useSendFeedback, useWorkshopFeedback } from "@/hooks/use-workshop";
import type { ApiSchema } from "@/types/api-helpers";
import { Button } from "@energetica/ui/components/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@energetica/ui/components/card";
import { Label } from "@energetica/ui/components/label";
import { Spinner } from "@energetica/ui/components/spinner";
import { cn } from "@energetica/ui/lib/utils";

type Feedback = ApiSchema<"WorkshopFeedback">;

const COMMENT_MAX_LENGTH = 4000;

export function GameFeedback() {
    const feedback = useWorkshopFeedback();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquareHeart className="size-5 text-brand" />
                    How was the game?
                </CardTitle>
                <CardDescription>
                    Your answers help us improve the workshop.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {feedback.isPending ? (
                    <div className="flex justify-center py-6">
                        <Spinner />
                    </div>
                ) : (
                    // Keyed on the saved answer, so the form starts from it once it loads.
                    <FeedbackForm
                        key={feedback.data ? "sent" : "new"}
                        sent={feedback.data ?? null}
                    />
                )}
            </CardContent>
        </Card>
    );
}

function FeedbackForm({ sent }: { sent: Feedback | null }) {
    const [fun, setFun] = useState(sent?.fun ?? 0);
    const [teaching, setTeaching] = useState(sent?.teaching ?? 0);
    const [comment, setComment] = useState(sent?.comment ?? "");
    const { mutate: send, isPending, isSuccess } = useSendFeedback();
    const commentId = useId();
    const complete = fun > 0 && teaching > 0;

    return (
        <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
                event.preventDefault();
                if (!complete) return;
                send({ fun, teaching, comment: comment.trim() || null });
            }}
        >
            <StarRating
                label="How fun was the game?"
                value={fun}
                onChange={setFun}
            />
            <StarRating
                label="How well did it teach you how the electricity market works?"
                value={teaching}
                onChange={setTeaching}
            />
            <div className="flex flex-col gap-2">
                <Label htmlFor={commentId}>
                    Anything else you'd like to tell us?{" "}
                    <span className="font-normal text-muted-foreground">
                        (optional)
                    </span>
                </Label>
                <textarea
                    id={commentId}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    maxLength={COMMENT_MAX_LENGTH}
                    rows={4}
                    placeholder="What did you enjoy, what was confusing, what would you change?"
                    className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                />
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!complete || isPending}>
                    {sent ? "Update feedback" : "Send feedback"}
                </Button>
                {isSuccess ? (
                    <span className="text-sm text-muted-foreground">
                        Thank you for your feedback!
                    </span>
                ) : !complete ? (
                    <span className="text-sm text-muted-foreground">
                        Pick a rating for both questions to send.
                    </span>
                ) : null}
            </div>
        </form>
    );
}

function StarRating({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
}) {
    const [hovered, setHovered] = useState(0);
    const shown = hovered || value;

    return (
        <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{label}</span>
            <div role="radiogroup" aria-label={label} className="flex gap-1">
                {[1, 2, 3, 4, 5].map((stars) => (
                    <button
                        key={stars}
                        type="button"
                        role="radio"
                        aria-checked={value === stars}
                        aria-label={`${stars} star${stars === 1 ? "" : "s"}`}
                        onClick={() => onChange(stars)}
                        onMouseEnter={() => setHovered(stars)}
                        onMouseLeave={() => setHovered(0)}
                        className="rounded-sm p-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                        <Star
                            className={cn(
                                "size-7 transition-colors",
                                stars <= shown
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground",
                            )}
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}
