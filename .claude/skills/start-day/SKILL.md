---
name: start-day
description: Bring the local brewprospects checkout to a known-good state (refresh main, clear finished worktrees and branches, check PRs, CI, the nightly data job, the Vercel deploy and post drafts) and report what needs a decision. Use when the user says "start day" or asks for the morning status check.
---

# /start-day

The first command of a session. It brings the checkout back to a known-good
state and reports what needs a decision. A day's work then never starts from a
stale `main`, a merged worktree or a dead branch.

Report results in plain words. Make the routine calls without asking. End with
a short list of what needs the maintainer. Do not offer technical options: pick
the sensible default and say what you did.

Do these without asking: fast-forward `main`, remove finished worktrees, delete
branches whose upstream is gone. Ask first for anything else, and for anything
outward-facing (push, merge, deploy).

Do not run `npm run e2e`. Do not run lint or build. This is a status check.

## Steps

Run in order, in the primary checkout (`C:\Users\gzilavy\brewprospects`).

1. **Refresh remote state.** `git fetch origin --prune`. Every step reads it.
2. **Update `main`.** If the primary checkout is on `main`, clean and behind,
   run `git pull --ff-only origin main`. If it has uncommitted changes, do not
   touch it. Name the files in the report. If it is on another branch, say
   which one and leave it.
3. **Worktrees.** Run `git worktree list` and `git worktree prune`. Remove a
   worktree now, with no question, when all of these are true: it is not the
   primary checkout, `git -C <path> status --short` is empty, and its branch is
   merged into `origin/main` or its upstream is gone
   (`git for-each-ref --format='%(refname:short) %(upstream:track)'
   refs/heads`). Use `git worktree remove <path>`, then `git branch -D <branch>`
   (`-d` refuses a squash-merged branch). A detached worktree that is clean and
   whose HEAD is an ancestor of `origin/main` also goes.
   Leave the rest and report counts: unmerged work, never pushed, uncommitted
   changes. Name each one under **Needs you** when it has uncommitted changes.
   - Stop any dev server on port 4321 or 4322 that belongs to a worktree you are
     about to remove. On Windows a running server locks the folder, and a
     removal then fails halfway and leaves the tree on disk.
   - Removal is slow on Windows (each worktree has its own `node_modules`). Run
     a batch in the background and poll it. A timed-out delete leaves a
     half-removed folder.
   - Then compare the folders next to the checkout (`ls -d ../brewprospects-*`)
     with `git worktree list`. A folder git no longer tracks is a leftover:
     delete it with `rm -rf` after you confirm git does not list it. Stray
     files that are not worktrees (for example `../brewprospects-shots`) are
     reported, never deleted without a yes.
4. **Dead branches.** Branches outlive worktrees. Delete every local branch
   whose upstream shows `[gone]` with `git branch -D`. A gone upstream means the
   PR merged or closed. Never touch a branch that still has an upstream, or one
   that never had one: that is unshared work. Report the count only.
5. **Open PRs and issues.** `gh pr list --state open`: for each PR, say whether
   checks pass and whether it waits on the maintainer (review, merge) or on an
   agent (in progress, changes requested). Then
   `gh issue list --state open --label ready-for-human`. Both go under
   **Needs you**.
6. **Post drafts.** Keystatic saves go to `post/*` branches, and drafts there
   are public. List unmerged ones:
   `git branch -r --no-merged origin/main | grep origin/post/`. Name each as a
   draft waiting on him. Say nothing when there are none.
7. **CI and deploy on `main`.** Run
   `gh run list --branch main --workflow=ci --limit 1` and
   `gh api repos/:owner/:repo/commits/main/status --jq '.state'`. The status
   is the Vercel deploy: every merge to `main` deploys, and a deploy can fail
   while CI stays green. Say nothing when both are green. Flag `failure` or
   `error` at once. Flag `pending` only if the commit is over 30 minutes old.
   If the status call returns nothing, try the Vercel connector
   (`list_deployments`, project `brewprospects`, team `gareedge`). If that also
   fails, say "could not check the deploy". Do not fail the skill.
8. **Nightly data job.** `gh run list --workflow=nightly-data --limit 3`. The
   job runs at 10:41 UTC (5:41 AM Central). A run that never happens cannot
   fail, so check that a run exists for today, not only that the last run
   passed. Flag a failed or missing run first in the report. The fix for either
   is `gh workflow run nightly-data`; one run catches up every missed night.
   Offer it, since it pushes to `main`.
9. **Data freshness.** Run `node scripts/data/freshness.mjs`. It needs the
   network and exits non-zero on stuck snapshots (for example `org.json` still
   on last season after 1 May). Also read `generatedAt` from
   `src/data/org.json` and `src/data/pipeline.json`. Report a stale one only
   if it is over 2 days old. Say nothing when fresh.
10. **Next on the roadmap.** Read `docs/roadmap.md`. Give one line: the next
    unfinished item of the current phase, with its number. This is context, not
    an action.

## Report format

Keep it short. A few lines of what you did, then:

> **Needs you:** ...

List only items that need a decision: a PR to merge, a `ready-for-human` issue,
a failed or missing nightly run, a failed deploy, a draft on a `post/*` branch,
a worktree with uncommitted changes, stale data. If nothing needs him, say
exactly that, and that he can start prompting normally.

Use counts, not inventories: "removed 3 finished worktrees and 12 dead
branches" is the report. Under **Needs you**, name the specific thing every
time.

Never end this skill by starting other work. Wait for his next prompt.
