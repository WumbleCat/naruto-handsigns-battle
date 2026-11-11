#!/usr/bin/env node
// Stop hook for Claude Code.
//
// Blocks the end of a turn while there are commits on the current branch that
// docs/PROGRESS.md does not yet reflect, and tells Claude to run the
// update-progress skill. Merge commits are ignored (they carry no new work),
// and uncommitted edits to PROGRESS.md count as "being updated right now".
//
// Input: hook JSON on stdin (uses `stop_hook_active` as a loop guard).
// Output: `{ "decision": "block", "reason": "..." }` on stdout to block; nothing to allow.
// Always exits 0 so a git hiccup never breaks the session.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const PROGRESS_FILE = 'docs/PROGRESS.md';
const MAX_LISTED = 15;

function git(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim();
  } catch {
    return null;
  }
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

function allow() {
  process.exit(0);
}

const raw = await readStdin();
let input = {};
try {
  input = raw ? JSON.parse(raw) : {};
} catch {
  input = {};
}

// Claude already continued once because of this hook; let the turn end.
if (input.stop_hook_active) allow();

if (!existsSync(PROGRESS_FILE)) allow();
if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') allow();

// Untracked or modified PROGRESS.md means an update is in progress.
const dirty = git(['status', '--porcelain', '--', PROGRESS_FILE]);
if (dirty) allow();

const lastProgressCommit = git(['log', '-1', '--format=%H', '--', PROGRESS_FILE]);
const range = lastProgressCommit ? `${lastProgressCommit}..HEAD` : 'HEAD';
const pending = (git(['log', '--no-merges', '--format=%h %s', range]) ?? '')
  .split('\n')
  .filter(Boolean);

if (pending.length === 0) allow();

const branch = git(['branch', '--show-current']) || '(detached)';
const listed = pending.slice(0, MAX_LISTED).map((line) => `  ${line}`);
if (pending.length > MAX_LISTED) listed.push(`  ...and ${pending.length - MAX_LISTED} more`);

const reason = [
  `${PROGRESS_FILE} is out of date: ${pending.length} commit(s) on ${branch} since it was last updated.`,
  ...listed,
  '',
  'Before finishing, run the update-progress skill (.claude/skills/update-progress/SKILL.md):',
  `update ${PROGRESS_FILE} (status, milestone tracker, update log, roadmap if scope changed)`,
  'and commit it on the current branch as "docs(progress): ...".',
  'If these commits genuinely need no progress entry, say so explicitly in your reply.',
].join('\n');

process.stdout.write(JSON.stringify({ decision: 'block', reason }));
