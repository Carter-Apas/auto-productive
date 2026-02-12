import { afterEach, describe, expect, it } from "vitest";

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  collectCodexActivity,
  pathInScanDirs,
  projectNameFromPath,
} from "./codex-sessions.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true }))
  );
  tempDirs.length = 0;
});

describe("projectNameFromPath", () => {
  it("extracts last path component", () => {
    expect(
      projectNameFromPath("/home/carter/Projects/client-work/web-app")
    ).toBe(
      "web-app"
    );
  });

  it("handles single component", () => {
    expect(projectNameFromPath("/project")).toBe("project");
  });

  it("handles trailing slash", () => {
    expect(
      projectNameFromPath("/home/carter/Projects/client-work/web-app/")
    ).toBe("web-app");
  });
});

describe("pathInScanDirs", () => {
  const scanDirs = [
    "/home/carter/Projects/client-work",
    "/home/carter/Projects/personal",
  ];

  it("matches paths under scan dirs", () => {
    expect(
      pathInScanDirs(
        "/home/carter/Projects/client-work/web-app",
        scanDirs
      )
    ).toBe(true);
    expect(
      pathInScanDirs(
        "/home/carter/Projects/personal/auto-productive",
        scanDirs
      )
    ).toBe(true);
  });

  it("matches exact scan dir path", () => {
    expect(pathInScanDirs("/home/carter/Projects/client-work", scanDirs)).toBe(
      true
    );
  });

  it("does not match sibling paths with shared prefix", () => {
    expect(
      pathInScanDirs("/home/carter/Projects/client-work2/project", scanDirs)
    ).toBe(false);
  });

  it("does not match outside scan dirs", () => {
    expect(pathInScanDirs("/home/carter/Documents/random", scanDirs)).toBe(
      false
    );
  });
});

describe("collectCodexActivity", () => {
  it("includes session user prompts from the selected day directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-productive-"));
    tempDirs.push(root);

    const sessionsRoot = join(root, "sessions");
    const dayDir = join(sessionsRoot, "2026", "02", "12");
    await mkdir(dayDir, { recursive: true });

    const filePath = join(dayDir, "rollout-test.jsonl");
    const lines = [
      JSON.stringify({
        timestamp: "2026-02-11T22:56:50.759Z",
        type: "session_meta",
        payload: {
          id: "session-1",
          cwd: "/home/carter/Projects/uoa/uoa-mono/search-analytics/apps/web",
        },
      }),
      JSON.stringify({
        timestamp: "2026-02-11T22:57:00.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Fix failing test suite" }],
        },
      }),
    ].join("\n");

    await writeFile(filePath, `${lines}\n`, "utf-8");

    const activities = await collectCodexActivity(
      sessionsRoot,
      ["/home/carter/Projects/uoa"],
      "2026-02-12"
    );

    expect(activities).toHaveLength(1);
    expect(activities[0]?.sessionId).toBe("session-1");
    expect(activities[0]?.projectPath).toBe(
      "/home/carter/Projects/uoa/uoa-mono/search-analytics/apps/web"
    );
    expect(activities[0]?.summaries).toEqual(["Fix failing test suite"]);
  });

  it("keeps sessions from subdirectories under scan dirs", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-productive-"));
    tempDirs.push(root);

    const sessionsRoot = join(root, "sessions");
    const dayDir = join(sessionsRoot, "2026", "02", "12");
    await mkdir(dayDir, { recursive: true });

    const filePath = join(dayDir, "rollout-nested.jsonl");
    const lines = [
      JSON.stringify({
        timestamp: "2026-02-12T00:00:00.000Z",
        type: "session_meta",
        payload: {
          id: "session-2",
          cwd: "/work/repo-with-productive/packages/api/src",
        },
      }),
      JSON.stringify({
        timestamp: "2026-02-12T00:01:00.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Implement endpoint handler" }],
        },
      }),
    ].join("\n");

    await writeFile(filePath, `${lines}\n`, "utf-8");

    const activities = await collectCodexActivity(
      sessionsRoot,
      ["/work/repo-with-productive"],
      "2026-02-12"
    );

    expect(activities).toHaveLength(1);
    expect(activities[0]?.projectPath).toBe("/work/repo-with-productive/packages/api/src");
  });
});
