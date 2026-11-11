---
name: update-progress
description: Update docs/PROGRESS.md (where the project is, milestone tracker, dated update log, roadmap, pending decisions) after commits, merges, tags or scope changes. Use when the Stop hook reports commits not yet logged, when a milestone or roadmap item changes state, when an owner decision resolves an open question, or when asked to log or report progress.
---

# Update progress

`docs/PROGRESS.md` is the project's living status page: where the project is, what changed
recently, and what comes next. Keep it true and readable. It is not a second changelog
(`CHANGELOG.md` holds per-version release notes) and not a design doc.

## When to run

- After committing work on any branch. The Stop hook in `.claude/settings.json` blocks the end
  of a turn while the current branch has non-merge commits newer than the file's last commit.
- After merging a branch into `main` or tagging a milestone.
- When scope changes: a milestone is added, split, re-ordered or dropped; a roadmap item moves.
- When the owner resolves an open decision.
- When the user asks for a progress update or status report. Then also summarise in chat.

## Procedure

1. Find what changed since the last update:

   ```
   git log -1 --format=%H -- docs/PROGRESS.md
   git log --no-merges --date=short --format="%h %ad %s" <that-hash>..HEAD
   git branch --show-current
   git tag --points-at HEAD
   git status --short
   ```

   If the file was never committed, the range is `HEAD` (everything).

2. Read `docs/PROGRESS.md` in full before editing.

3. Update, in this order:
   - **Header**: "Last updated" to today's date (YYYY-MM-DD) and the current branch.
   - **Where we are**: rewrite the paragraphs so they are true now. Always end with the next
     action.
   - **Milestone tracker**: change statuses; fill Tag and Done when a milestone is tagged.
     Allowed statuses: Planned, Not started, In progress, In review, Done, Blocked.
   - **Update log**: add bullets under today's date heading (`### YYYY-MM-DD`, newest first;
     create it if missing). One bullet per unit of work, starting with the branch in backticks.
     Say what changed and why it matters to the player or the project, not which files were
     touched. Fold trivial follow-up commits into the existing bullet instead of adding noise.
   - **Roadmap**: touch only when scope or order changes. Shipped items leave the roadmap; the
     tracker and the log already record them.
   - **Decisions pending**: remove resolved items and record the decision in today's log entry.

4. Keep the file under about 250 lines. When the update log passes 40 entries, move entries
   older than the previous milestone tag into `docs/PROGRESS_ARCHIVE.md` (same format) and link
   it from the log heading.

5. Commit on the current branch:

   ```
   git add docs/PROGRESS.md
   git commit -m "docs(progress): <what the entry covers>"
   ```

   Never commit on `main` directly. After a merge into `main` nothing is needed: merge commits
   are ignored by the hook, and the entry for the merged work was written on its branch.

6. If a milestone was tagged, confirm `CHANGELOG.md` has the matching version section.

## Entry style

```
### 2026-12-02

- `feat/engine-core`: The battle engine now resolves clashes and Substitution, and the full
  rule set from DESIGN.md section 5 has tests. Unblocks the battle page.
- `fix/stabiliser-release`: A held pose no longer registers twice. Found while testing the
  keyboard detector.
```

- Sentence case, plain verbs, past tense for what happened, present tense for what is true.
- No commit hashes, no file lists, no restating the commit message verbatim.
- Write for the owner reading it in two weeks.

## Do not

- Rewrite or delete past log entries. Correct a mistake with a new line that says what was wrong.
- Duplicate `CHANGELOG.md` or the design docs; link to them.
- Pad. If nothing user-visible or structural changed, one honest line beats invented significance.
- Leave the edit uncommitted. An unstaged change satisfies the hook for this turn only; the
  next turn will block again.
