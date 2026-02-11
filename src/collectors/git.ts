import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { logger } from "../logger.js";
import type { GitCommit, RepoActivity } from "../types.js";

const execFileAsync = promisify(execFile);

export async function collectGitActivity(
  productiveFolders: string[],
  author: string,
  date: string,
): Promise<RepoActivity[]> {
  logger.info(`Collecting git activity for ${author} on ${date}`);

  const repos = await resolveGitRepos(productiveFolders);
  logger.info(`Found ${repos.length} git repo(s) from .productive folders`);

  const activities: RepoActivity[] = [];

  for (const repoPath of repos) {
    try {
      const commits = await getCommits(repoPath, author, date);
      if (commits.length > 0) {
        const repoName = repoPath.split("/").pop() ?? repoPath;
        activities.push({ repoName, repoPath, commits });
        logger.info(`  ${repoName}: ${commits.length} commit(s)`);
      }
    } catch (err) {
      logger.warn(`  Failed to get git log from ${repoPath}: ${err}`);
    }
  }

  return activities;
}

async function resolveGitRepos(productiveFolders: string[]): Promise<string[]> {
  const uniqueFolders = [...new Set(productiveFolders)];
  const repos: string[] = [];

  for (const folder of uniqueFolders) {
    if (await isGitRepo(folder)) {
      repos.push(folder);
      continue;
    }
    logger.warn(`Skipping .productive folder that is not a git repo: ${folder}`);
  }

  return repos;
}

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    const gitDir = join(dir, ".git");
    const s = await stat(gitDir);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function getCommits(
  repoPath: string,
  author: string,
  date: string,
): Promise<GitCommit[]> {
  // git log for the given date, by the author
  const { stdout } = await execFileAsync(
    "git",
    [
      "log",
      `--author=${author}`,
      "--regexp-ignore-case",
      `--after=${date} 00:00:00`,
      `--before=${date} 23:59:59`,
      "--format=%H|%s",
      "--shortstat",
    ],
    { cwd: repoPath, timeout: 10000 },
  );

  return parseGitLog(stdout);
}

export function parseGitLog(output: string): GitCommit[] {
  const commits: GitCommit[] = [];
  const lines = output.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // Expect: hash|subject
    const pipeIndex = line.indexOf("|");
    if (pipeIndex === -1) {
      i++;
      continue;
    }

    const hash = line.slice(0, pipeIndex).slice(0, 7); // short hash
    const subject = line.slice(pipeIndex + 1);

    // Next non-empty line might be the --shortstat line
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;

    i++;
    while (i < lines.length && lines[i].trim() === "") {
      i++;
    }

    if (i < lines.length) {
      const statLine = lines[i].trim();
      const statMatch = statLine.match(
        /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/,
      );
      if (statMatch) {
        filesChanged = parseInt(statMatch[1], 10);
        insertions = parseInt(statMatch[2] ?? "0", 10);
        deletions = parseInt(statMatch[3] ?? "0", 10);
        i++;
      }
    }

    commits.push({ hash, subject, filesChanged, insertions, deletions });
  }

  return commits;
}
