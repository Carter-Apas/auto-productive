import { describe, expect, it } from "vitest";

import { formatNotes } from "./notes.js";
import type {
  CodexSessionActivity,
  ProjectMatch,
  RepoActivity,
  ResolvedBooking,
} from "./types.js";

const booking: ResolvedBooking = {
  bookingId: "1",
  serviceId: "10",
  serviceNumber: "42",
  billedClient: "Example Client",
  dealId: "20",
  projectId: "30",
  projectName: "Frontend",
  serviceName: "Development",
  timeMinutes: 480,
};

describe("formatNotes", () => {
  it("formats git activity", () => {
    const repo: RepoActivity = {
      repoName: "web-app",
      repoPath: "/home/carter/Projects/",
      commits: [
        {
          hash: "abc1234",
          subject: "Fix navigation breadcrumb",
          filesChanged: 3,
          insertions: 45,
          deletions: 12,
        },
        {
          hash: "def5678",
          subject: "Add unit tests",
          filesChanged: 5,
          insertions: 100,
          deletions: 20,
        },
      ],
    };

    const matches: ProjectMatch[] = [
      { activity: repo, booking, matchType: "manual" },
    ];
    const note = formatNotes(matches);

    expect(note).toContain("## Git Activity");
    expect(note).toContain("**web-app** (2 commits)");
    expect(note).toContain("- abc1234 Fix navigation breadcrumb");
    expect(note).toContain("- def5678 Add unit tests");
    expect(note).toContain("(8 files changed, +145, -32)");
  });

  it("formats codex session activity", () => {
    const session: CodexSessionActivity = {
      sessionId: "abc-123",
      projectPath: "/home/carter/Projects/",
      sessionFile:
        "rollout-2026-02-10T14-43-29-019c4537-c97b-7052-9780-979659ba901d.jsonl",
      summaries: ["Fix the navigation breadcrumb styling", "Debug CORS issues"],
    };

    const matches: ProjectMatch[] = [
      { activity: session, booking, matchType: "manual" },
    ];
    const note = formatNotes(matches);

    expect(note).toContain("## Codex Sessions");
    expect(note).toContain("- Fix the navigation breadcrumb styling");
    expect(note).toContain("- Debug CORS issues");
  });

  it("returns empty string for no matches", () => {
    expect(formatNotes([])).toBe("");
  });

  it("combines git and codex sections", () => {
    const repo: RepoActivity = {
      repoName: "web-app",
      repoPath: "/path",
      commits: [
        {
          hash: "abc1234",
          subject: "Fix bug",
          filesChanged: 1,
          insertions: 5,
          deletions: 2,
        },
      ],
    };
    const session: CodexSessionActivity = {
      sessionId: "s1",
      projectPath: "/path",
      sessionFile: "rollout-file.jsonl",
      summaries: ["Worked on fixing bug"],
    };

    const matches: ProjectMatch[] = [
      { activity: repo, booking, matchType: "manual" },
      { activity: session, booking, matchType: "manual" },
    ];
    const note = formatNotes(matches);

    expect(note).toContain("## Git Activity");
    expect(note).toContain("## Codex Sessions");
  });

  it("truncates to max length", () => {
    const repo: RepoActivity = {
      repoName: "repo",
      repoPath: "/path",
      commits: Array.from({ length: 100 }, (_, i) => ({
        hash: `hash${String(i).padStart(3, "0")}`,
        subject: `Very long commit message number ${i} that takes up lots of space in the note content`,
        filesChanged: 10,
        insertions: 100,
        deletions: 50,
      })),
    };

    const matches: ProjectMatch[] = [
      { activity: repo, booking, matchType: "manual" },
    ];
    const note = formatNotes(matches);

    expect(note.length).toBeLessThanOrEqual(2000);
  });
});
