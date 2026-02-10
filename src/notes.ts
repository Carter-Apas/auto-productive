import type {
  CodexSessionActivity,
  ProjectMatch,
  RepoActivity,
} from "./types.js";

const MAX_NOTE_LENGTH = 2000;

export function formatNotes(matches: ProjectMatch[]): string {
  const gitActivities: RepoActivity[] = [];
  const codexActivities: CodexSessionActivity[] = [];

  for (const match of matches) {
    if ("commits" in match.activity) {
      gitActivities.push(match.activity);
    } else {
      codexActivities.push(match.activity);
    }
  }

  const sections: string[] = [];

  // Git section (prioritized)
  if (gitActivities.length > 0) {
    sections.push(formatGitSection(gitActivities));
  }

  // Codex section
  if (codexActivities.length > 0) {
    sections.push(formatCodexSection(codexActivities));
  }

  if (sections.length === 0) {
    return "";
  }

  let note = sections.join("\n\n");

  // Truncate if needed, prioritizing git over Codex
  if (note.length > MAX_NOTE_LENGTH) {
    if (gitActivities.length > 0) {
      // Try with just git section
      note = formatGitSection(gitActivities);
      if (note.length > MAX_NOTE_LENGTH) {
        note = note.slice(0, MAX_NOTE_LENGTH - 3) + "...";
      }
    } else {
      note = note.slice(0, MAX_NOTE_LENGTH - 3) + "...";
    }
  }

  return note;
}

function formatGitSection(activities: RepoActivity[]): string {
  const lines: string[] = ["## Git Activity"];

  for (const repo of activities) {
    lines.push(
      `**${repo.repoName}** (${repo.commits.length} commit${repo.commits.length === 1 ? "" : "s"})`,
    );

    for (const commit of repo.commits) {
      lines.push(`- ${commit.hash} ${commit.subject}`);
    }

    // Add aggregate stats
    const totalFiles = repo.commits.reduce((sum, c) => sum + c.filesChanged, 0);
    const totalInsertions = repo.commits.reduce(
      (sum, c) => sum + c.insertions,
      0,
    );
    const totalDeletions = repo.commits.reduce(
      (sum, c) => sum + c.deletions,
      0,
    );

    if (totalFiles > 0) {
      lines.push(
        `  (${totalFiles} files changed, +${totalInsertions}, -${totalDeletions})`,
      );
    }
  }

  return lines.join("\n");
}

function formatCodexSection(activities: CodexSessionActivity[]): string {
  const lines: string[] = ["## Codex Sessions"];

  // Deduplicate and summarize user messages across sessions
  const seen = new Set<string>();

  for (const session of activities) {
    for (const summary of session.summaries) {
      // Use first 100 chars as dedup key
      const key = summary.slice(0, 100).toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      // Trim long summaries
      const trimmed =
        summary.length > 120 ? summary.slice(0, 117) + "..." : summary;
      lines.push(`- ${trimmed}`);
    }
  }

  return lines.join("\n");
}
