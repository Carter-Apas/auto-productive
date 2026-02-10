import { describe, expect, it } from "vitest";

import { pathInScanDirs, projectNameFromPath } from "./codex-sessions.js";

describe("projectNameFromPath", () => {
  it("extracts last path component", () => {
    expect(
      projectNameFromPath("/home/carter/Projects/client-work/web-app"),
    ).toBe(
      "web-app",
    );
  });

  it("handles single component", () => {
    expect(projectNameFromPath("/project")).toBe("project");
  });

  it("handles trailing slash", () => {
    expect(
      projectNameFromPath("/home/carter/Projects/client-work/web-app/"),
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
        scanDirs,
      ),
    ).toBe(true);
    expect(
      pathInScanDirs(
        "/home/carter/Projects/personal/auto-productive",
        scanDirs,
      ),
    ).toBe(true);
  });

  it("matches exact scan dir path", () => {
    expect(pathInScanDirs("/home/carter/Projects/client-work", scanDirs)).toBe(
      true,
    );
  });

  it("does not match sibling paths with shared prefix", () => {
    expect(
      pathInScanDirs("/home/carter/Projects/client-work2/project", scanDirs),
    ).toBe(false);
  });

  it("does not match outside scan dirs", () => {
    expect(pathInScanDirs("/home/carter/Documents/random", scanDirs)).toBe(
      false,
    );
  });
});
