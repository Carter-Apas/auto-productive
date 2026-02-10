import { describe, expect, it } from "vitest";

import { parseGitLog } from "./git.js";

describe("parseGitLog", () => {
  it("parses commits with stats", () => {
    const output = `abc1234deadbeef|Fix navigation breadcrumb component

 3 files changed, 45 insertions(+), 12 deletions(-)
def5678deadbeef|Add unit tests for user service

 5 files changed, 100 insertions(+), 20 deletions(-)
`;

    const commits = parseGitLog(output);
    expect(commits).toHaveLength(2);

    expect(commits[0].hash).toBe("abc1234");
    expect(commits[0].subject).toBe("Fix navigation breadcrumb component");
    expect(commits[0].filesChanged).toBe(3);
    expect(commits[0].insertions).toBe(45);
    expect(commits[0].deletions).toBe(12);

    expect(commits[1].hash).toBe("def5678");
    expect(commits[1].subject).toBe("Add unit tests for user service");
    expect(commits[1].filesChanged).toBe(5);
    expect(commits[1].insertions).toBe(100);
    expect(commits[1].deletions).toBe(20);
  });

  it("parses commits without stats", () => {
    const output = `abc1234deadbeef|Merge branch 'main'
`;

    const commits = parseGitLog(output);
    expect(commits).toHaveLength(1);
    expect(commits[0].hash).toBe("abc1234");
    expect(commits[0].filesChanged).toBe(0);
    expect(commits[0].insertions).toBe(0);
    expect(commits[0].deletions).toBe(0);
  });

  it("handles insertions only", () => {
    const output = `abc1234deadbeef|Add new file

 1 file changed, 50 insertions(+)
`;

    const commits = parseGitLog(output);
    expect(commits).toHaveLength(1);
    expect(commits[0].filesChanged).toBe(1);
    expect(commits[0].insertions).toBe(50);
    expect(commits[0].deletions).toBe(0);
  });

  it("handles deletions only", () => {
    const output = `abc1234deadbeef|Remove old file

 1 file changed, 30 deletions(-)
`;

    const commits = parseGitLog(output);
    expect(commits).toHaveLength(1);
    expect(commits[0].filesChanged).toBe(1);
    expect(commits[0].insertions).toBe(0);
    expect(commits[0].deletions).toBe(30);
  });

  it("handles empty output", () => {
    expect(parseGitLog("")).toHaveLength(0);
    expect(parseGitLog("\n\n")).toHaveLength(0);
  });
});
