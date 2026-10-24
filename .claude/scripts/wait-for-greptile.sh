#!/usr/bin/env bash
# Wait for Greptile to finish reviewing a PR, then print its findings in one place.
#
# Usage: wait-for-greptile.sh <pr-number-or-url> [--retrigger]
#
#   --retrigger  Post an `@greptileai` comment to request a new review (after pushing fixes),
#                then wait for that review. Greptile does not re-review on push by itself.
#
# Greptile marks a review with a "Greptile Review" check run on the PR's latest commit. This
# script waits for that check to appear and complete, then prints the confidence score from
# the PR description, the inline review comments, and the "Comments Outside Diff" comment.
#
# Exit codes: 0 review printed, 3 no Greptile review is coming, 4 timed out, 1 error.
# Run it with the Bash tool's run_in_background: true. A review usually takes about 2 minutes.
set -euo pipefail

APPEAR_TIMEOUT=90     # seconds to wait for the check run to show up
COMPLETE_TIMEOUT=900  # seconds to wait for it to finish
POLL=15
BOT="greptile-apps[bot]"

pr="${1:-}"
[ -n "$pr" ] || { echo "usage: $0 <pr-number-or-url> [--retrigger]" >&2; exit 1; }
retrigger=false
[ "${2:-}" = "--retrigger" ] && retrigger=true

info="$(gh pr view "$pr" --json number,url,headRefOid,baseRefName)"
number="$(jq -r .number <<<"$info")"
sha="$(jq -r .headRefOid <<<"$info")"
base="$(jq -r .baseRefName <<<"$info")"
repo="$(jq -r .url <<<"$info" | sed -E 's#https://github.com/([^/]+/[^/]+)/pull/.*#\1#')"

# Ignore check runs and comments from before this point. Empty means "any time".
since=""
if $retrigger; then
    since="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    gh pr comment "$number" --repo "$repo" --body "@greptileai" >/dev/null
    echo "Posted @greptileai on PR #$number; waiting for the new review."
fi

greptile_run() {
    gh api "repos/$repo/commits/$sha/check-runs" \
        -q "[.check_runs[] | select(.app.slug == \"greptile-apps\") | select(\"$since\" == \"\" or .started_at >= \"$since\")] | first // empty"
}

echo "Waiting for Greptile on PR #$number (commit ${sha:0:7}, base $base)..."
waited=0
run="$(greptile_run)"
while [ -z "$run" ]; do
    if [ "$waited" -ge "$APPEAR_TIMEOUT" ]; then
        echo "No Greptile review started on commit ${sha:0:7} within ${APPEAR_TIMEOUT}s."
        echo "Greptile only reviews automatically when a PR is opened, and seems to skip PRs whose base"
        echo "is not the default branch (this one targets '$base'). If you pushed commits after the last"
        echo "review, request a new one with: $0 $number --retrigger"
        exit 3
    fi
    sleep "$POLL"; waited=$((waited + POLL))
    run="$(greptile_run)"
done

started="$(jq -r .started_at <<<"$run")"
while [ "$(jq -r .status <<<"$run")" != "completed" ]; do
    if [ "$waited" -ge "$COMPLETE_TIMEOUT" ]; then
        echo "Greptile's review (started $started) had not finished after ${COMPLETE_TIMEOUT}s." >&2
        exit 4
    fi
    sleep "$POLL"; waited=$((waited + POLL))
    run="$(greptile_run)"
done

echo
echo "=== Greptile review of PR #$number: $(jq -r '.conclusion' <<<"$run")"
jq -r '.output.summary // empty' <<<"$run"

score="$(gh pr view "$number" --repo "$repo" --json body -q .body | sed -nE 's/.*<!-- greptile_confidence_score:([0-9]+) -->.*/\1/p' | tail -1)"
echo "Confidence score: ${score:-not found}/5 (full summary is in the PR description)"

# Greptile's comment bodies open with a badge image; keep only its label, e.g. "[P1]".
clean='gsub("(<a[^>]*>)?<img alt=\"(?<l>[^\"]*)\"[^>]*>(</a>)?"; "[\(.l)]") | gsub("&nbsp;"; " ") | gsub("\n+Note: If this suggestion[^\n]*"; "")'

# Resolving a thread needs its GraphQL node id; map each thread's first comment id to it.
threads="$(gh api graphql -F owner="${repo%%/*}" -F name="${repo##*/}" -F pr="$number" -f query='
    query($owner: String!, $name: String!, $pr: Int!) {
        repository(owner: $owner, name: $name) { pullRequest(number: $pr) {
            reviewThreads(first: 100) { nodes { id comments(first: 1) { nodes { databaseId } } } }
        } }
    }' -q '[.data.repository.pullRequest.reviewThreads.nodes[] | {key: (.comments.nodes[0].databaseId | tostring), value: .id}] | from_entries')"

echo
echo "=== Inline comments (reply in each thread: gh api repos/$repo/pulls/$number/comments/<id>/replies -f body=...)"
echo "=== (resolve a thread: gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: \"<thread>\"}) { thread { isResolved } } }')"
gh api --paginate "repos/$repo/pulls/$number/comments" \
    | jq -rs --argjson threads "$threads" "
    add | .[] | select(.user.login == \"$BOT\") | select(.created_at >= \"$started\")
    | (\$threads[(.in_reply_to_id // .id) | tostring] // \"?\") as \$thread
    | \"--- id=\(.id) thread=\(\$thread) \(.path):\(.line // .original_line)\(if .in_reply_to_id then \" (reply in thread \(.in_reply_to_id))\" else \"\" end)\n\(.body | $clean)\n\"" \
    | sed '/^$/N;/^\n$/D'

echo "=== Comments outside the diff (reply on the PR, quoting the finding)"
gh api --paginate "repos/$repo/issues/$number/comments" -q "
    .[] | select(.user.login == \"$BOT\") | select(.updated_at >= \"$started\")
    | \"--- id=\(.id)\n\(.body | $clean)\n\""
