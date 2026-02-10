import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";

import { logger } from "../logger.js";
import type { CodexSessionActivity } from "../types.js";

interface ParsedSession {
  sessionId: string;
  projectPath: string | null;
  summaries: string[];
}

interface JsonObject {
  [key: string]: unknown;
}

export async function collectCodexActivity(
  codexSessionsDir: string,
  scanDirs: string[],
  date: string,
): Promise<CodexSessionActivity[]> {
  logger.info(`Collecting Codex session activity for ${date}`);

  const activities: CodexSessionActivity[] = [];
  const dayDir = join(
    codexSessionsDir,
    date.slice(0, 4),
    date.slice(5, 7),
    date.slice(8, 10),
  );

  let sessionFiles: string[];
  try {
    const files = await readdir(dayDir);
    sessionFiles = files.filter((fileName) => fileName.endsWith(".jsonl"));
  } catch {
    logger.warn(`Cannot read Codex sessions directory: ${dayDir}`);
    return [];
  }

  for (const sessionFile of sessionFiles) {
    const filePath = join(dayDir, sessionFile);
    const parsed = await parseSessionFile(filePath, date);

    if (!parsed.projectPath || parsed.summaries.length === 0) {
      continue;
    }

    if (!pathInScanDirs(parsed.projectPath, scanDirs)) {
      logger.debug(
        `Skipping Codex session outside scan dirs: ${parsed.projectPath}`,
      );
      continue;
    }

    activities.push({
      sessionId: parsed.sessionId,
      projectPath: parsed.projectPath,
      sessionFile,
      summaries: parsed.summaries,
    });
  }

  logger.info(
    `Found ${activities.length} Codex session(s) with activity on ${date}`,
  );
  return activities;
}

async function parseSessionFile(
  filePath: string,
  date: string,
): Promise<ParsedSession> {
  const summaries: string[] = [];
  let projectPath: string | null = null;
  let sessionId = basename(filePath, ".jsonl");

  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    try {
      const entry = JSON.parse(line) as JsonObject;
      const entryType = entry.type;
      const timestamp = entry.timestamp;
      const onTargetDate =
        typeof timestamp === "string" && timestamp.startsWith(date);

      if (entryType === "session_meta" && isJsonObject(entry.payload)) {
        const cwd = entry.payload.cwd;
        const id = entry.payload.id;
        if (typeof cwd === "string") {
          projectPath = cwd;
        }
        if (typeof id === "string") {
          sessionId = id;
        }
        continue;
      }

      if (
        !onTargetDate ||
        entryType !== "response_item" ||
        !isJsonObject(entry.payload)
      ) {
        continue;
      }

      if (entry.payload.type !== "message" || entry.payload.role !== "user") {
        continue;
      }

      const content = extractUserMessageText(entry.payload.content);
      if (isLikelyUserPrompt(content)) {
        summaries.push(content.trim());
      }
    } catch {
      // Malformed JSONL line, skip.
    }
  }

  return { sessionId, projectPath, summaries };
}

function extractUserMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }

  const parts: string[] = [];

  for (const block of content) {
    if (!isJsonObject(block)) {
      continue;
    }
    if (block.type !== "input_text" && block.type !== "text") {
      continue;
    }
    if (typeof block.text !== "string") {
      continue;
    }
    parts.push(block.text);
  }

  return parts.join(" ").trim();
}

function isLikelyUserPrompt(content: string): boolean {
  if (content.length <= 10 || content.length >= 500) {
    return false;
  }

  const normalized = content.toLowerCase();
  return !(
    normalized.includes("<environment_context>") ||
    normalized.includes("<permissions instructions>") ||
    normalized.includes("<collaboration_mode>") ||
    normalized.startsWith("# agents.md instructions")
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function projectNameFromPath(projectPath: string): string {
  const parts = projectPath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? projectPath;
}

function normalizePath(path: string): string {
  return path.replace(/\/+$/, "") || "/";
}

export function pathInScanDirs(
  projectPath: string,
  scanDirs: string[],
): boolean {
  const normalizedProjectPath = normalizePath(projectPath);

  return scanDirs
    .map((scanDir) => normalizePath(scanDir))
    .some((scanDir) => {
      if (normalizedProjectPath === scanDir) {
        return true;
      }
      return normalizedProjectPath.startsWith(`${scanDir}/`);
    });
}
