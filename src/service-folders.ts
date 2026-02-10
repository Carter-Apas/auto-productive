import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { logger } from "./logger.js";

const SKIP_DIRS = new Set([".git", "node_modules", "dist"]);

function normalizePath(path: string): string {
  return path.replace(/\/+$/, "") || "/";
}

function parseServiceId(content: string): string | null {
  const trimmed = content.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

async function readServiceIdFile(folderPath: string): Promise<string | null> {
  try {
    const content = await readFile(join(folderPath, ".productive"), "utf-8");
    const serviceId = parseServiceId(content);
    if (!serviceId) {
      logger.warn(
        `Invalid .productive file at ${join(folderPath, ".productive")} (expected numeric service id)`,
      );
      return null;
    }
    return serviceId;
  } catch {
    return null;
  }
}

async function walkFolders(
  folderPath: string,
  map: Map<string, string[]>,
): Promise<void> {
  let entries;
  try {
    entries = await readdir(folderPath, { withFileTypes: true });
  } catch {
    return;
  }

  const serviceId = await readServiceIdFile(folderPath);
  if (serviceId) {
    const existing = map.get(serviceId) ?? [];
    existing.push(folderPath);
    map.set(serviceId, existing);
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }
    await walkFolders(join(folderPath, entry.name), map);
  }
}

export async function discoverServiceFolders(
  scanDirs: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();

  for (const scanDir of scanDirs) {
    await walkFolders(resolve(scanDir), map);
  }

  return map;
}

export function isPathWithinFolder(path: string, folder: string): boolean {
  const normalizedPath = normalizePath(resolve(path));
  const normalizedFolder = normalizePath(resolve(folder));
  return (
    normalizedPath === normalizedFolder ||
    normalizedPath.startsWith(`${normalizedFolder}/`)
  );
}

export function isPathWithinAnyFolder(
  path: string,
  folders: string[],
): boolean {
  return folders.some((folder) => isPathWithinFolder(path, folder));
}
