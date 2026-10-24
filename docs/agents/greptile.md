# Greptile reviews

Greptile, an AI code reviewer, reviews each PR automatically when it is opened. Its review
usually lands about 2 minutes later. It does not review again when you push. It also seems to
skip PRs whose base branch is not `main`.

## After opening a PR

A Claude Code hook (`.claude/hooks/greptile-after-pr-create.sh`) runs after `gh pr create`. It
tells the agent how to wait for the review, reply to its comments and resolve threads.
Greptile accepts a reply by reacting to it with a thumbs up.

## Picking up a PR you did not open

Read Greptile's latest review with:

```sh
.claude/scripts/wait-for-greptile.sh <pr>
```

It waits until the review is finished, then prints the confidence score, the inline comments
(with their comment and thread ids) and any findings on lines outside the diff. Run it in the
background, since it can wait several minutes. After pushing fixes, add `--retrigger` to post
an `@greptileai` comment, which requests a new review, and wait for it.

Exit codes: 0 review printed, 3 no review is coming, 4 timed out, 1 error.

## Requirements

`gh`, logged in with access to the repo, and `jq`.
