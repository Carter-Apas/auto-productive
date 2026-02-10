import { afterEach, describe, expect, it } from "vitest";

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  discoverServiceFolders,
  isPathWithinAnyFolder,
} from "./service-folders.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

describe("discoverServiceFolders", () => {
  it("finds multiple folders mapped to the same service id", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-productive-"));
    tempDirs.push(root);

    const scanDir = join(root, "scan");
    const repoA = join(scanDir, "repo-a");
    const repoB = join(scanDir, "nested", "repo-b");
    await mkdir(repoA, { recursive: true });
    await mkdir(repoB, { recursive: true });
    await writeFile(join(repoA, ".productive"), "123", "utf-8");
    await writeFile(join(repoB, ".productive"), "123", "utf-8");

    const map = await discoverServiceFolders([scanDir]);
    expect(map.get("123")).toHaveLength(2);
  });

  it("ignores invalid .productive files", async () => {
    const root = await mkdtemp(join(tmpdir(), "auto-productive-"));
    tempDirs.push(root);

    const scanDir = join(root, "scan");
    const repo = join(scanDir, "repo");
    await mkdir(repo, { recursive: true });
    await writeFile(join(repo, ".productive"), "abc", "utf-8");

    const map = await discoverServiceFolders([scanDir]);
    expect(map.size).toBe(0);
  });
});

describe("isPathWithinAnyFolder", () => {
  it("matches exact and nested paths", () => {
    const folders = ["/a/b/repo"];
    expect(isPathWithinAnyFolder("/a/b/repo", folders)).toBe(true);
    expect(isPathWithinAnyFolder("/a/b/repo/src/file", folders)).toBe(true);
    expect(isPathWithinAnyFolder("/a/b/repo2", folders)).toBe(false);
  });
});
