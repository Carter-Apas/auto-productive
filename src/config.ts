import "dotenv/config";
import type { Config } from "./types.js";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
    console.error(`Copy .env.example to .env and fill in your values.`);
    process.exit(1);
  }
  return value;
}

function requireAnyEnv(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }
  console.error(
    `Missing required environment variable: one of ${keys.join(", ")}`,
  );
  console.error(`Copy .env.example to .env and fill in your values.`);
  process.exit(1);
}

function todayISO(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

interface ParsedArgs {
  confirm: boolean;
  date: string | null;
}

function parseArgs(): ParsedArgs {
  let confirm = false;
  let date: string | null = null;

  for (const arg of process.argv.slice(2)) {
    if (arg === "--confirm") {
      confirm = true;
    } else if (arg.startsWith("--date=")) {
      date = arg.slice(7);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.error(`Invalid date format: ${date}. Use YYYY-MM-DD.`);
        process.exit(1);
      }
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: auto-productive [options]

Options:
  --confirm                 Prompt before submitting each time entry
  --date=YYYY-MM-DD         Use a specific date instead of today
  --help, -h                Show this help message

Environment:
  OPENAI_API_KEY            Required for note formatting (or use CHATGPT_API_KEY)
  CHATGPT_MODEL             Optional model override (default: gpt-4o-mini)
  SCAN_DIRS                 Comma-separated root folders to scan for .productive files`);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  return { confirm, date };
}

export function loadConfig(): Config {
  const args = parseArgs();

  return {
    productiveApiToken: requireEnv("PRODUCTIVE_API_TOKEN"),
    productiveOrgId: requireEnv("PRODUCTIVE_ORG_ID"),
    productivePersonId: requireEnv("PRODUCTIVE_PERSON_ID"),
    chatgptApiKey: requireAnyEnv(["CHATGPT_API_KEY", "OPENAI_API_KEY"]),
    chatgptModel: process.env.CHATGPT_MODEL || "gpt-4o-mini",
    scanDirs: requireEnv("SCAN_DIRS")
      .split(",")
      .map((d) => d.trim()),
    gitAuthorName: requireEnv("GIT_AUTHOR_NAME"),
    codexSessionsDir: requireEnv("CODEX_SESSIONS_DIR"),
    confirm: args.confirm,
    date: args.date ?? todayISO(),
  };
}
