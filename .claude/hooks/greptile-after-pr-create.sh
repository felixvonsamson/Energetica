#!/bin/bash
# PostToolUse hook (matcher: Bash). After an agent opens a PR with `gh pr create`, tell it that
# Greptile will review the PR and how to pick up the review. It only informs: waiting is left
# to the agent, with .claude/scripts/wait-for-greptile.sh as the ready-made way to do it.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

echo "$COMMAND" | grep -qE '\bgh[[:space:]]+pr[[:space:]]+create\b' || exit 0

# Only once the PR exists: gh prints its URL on success.
URL=$(echo "$INPUT" | jq -r '.tool_response | if type == "object" then (.stdout // "") else tostring end' \
    | grep -oE 'https://github\.com/[^[:space:]]+/pull/[0-9]+' | tail -1)
[ -n "$URL" ] || exit 0
SCRIPT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}/.claude/scripts/wait-for-greptile.sh"
PR="${URL##*/}"
REPO=$(echo "$URL" | sed -E 's#https://github\.com/([^/]+/[^/]+)/pull/.*#\1#')

read -r -d '' NOTE <<EOF
Greptile, an AI code reviewer, reviews PRs on this repo automatically when they are opened. Its review of PR #$PR usually lands about 2 minutes after opening. Unless you have a reason not to, wait for it and address it before reporting the PR as done. If you skip it, tell the user why.

To wait, run \`$SCRIPT $PR\` with run_in_background: true. It exits once the review is finished and prints everything in one place:
- the confidence score (Greptile also appends a section to the end of the PR description, below your text, with a summary and a score out of 5),
- inline review comments tied to a file and line, with their comment ids and thread ids,
- a "Comments Outside Diff" PR comment for findings on lines the diff does not touch.
It exits 3 if no review is coming. Greptile seems to skip PRs whose base is not the default branch.

To address the review, fix what is valid. Reply in each inline comment's thread with what you changed, or why the finding does not apply: \`gh api repos/$REPO/pulls/$PR/comments/<id>/replies -f body=...\`. For outside-diff findings, reply on the PR and quote the finding.

Greptile reads your reply and, if it accepts it, reacts to it with a thumbs up, usually within 10 seconds. About 15 seconds after replying, check the reactions on your reply: \`gh api repos/$REPO/pulls/comments/<your-reply-id>/reactions -q '.[] | select(.user.login == "greptile-apps[bot]") | .content'\`. If that prints \`+1\`, resolve the thread: \`gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<thread>"}) { thread { isResolved } } }'\`. Otherwise leave the thread open for the user, and read any reply Greptile posted in it.

Greptile does not re-review on push. After pushing fixes, you may request one new review with \`$SCRIPT $PR --retrigger\`. It posts an \`@greptileai\` comment and waits for that review.
EOF

jq -n --arg ctx "$NOTE" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
