type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

let debugEnabled = false;

export function enableDebug(): void {
  debugEnabled = true;
}

function log(level: LogLevel, ...args: unknown[]): void {
  if (level === "DEBUG" && !debugEnabled) {
    return;
  }
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = `${timestamp} [${level}]`;
  if (level === "ERROR") {
    console.error(prefix, ...args);
  } else if (level === "WARN") {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
}

export const logger = {
  info: (...args: unknown[]) => log("INFO", ...args),
  warn: (...args: unknown[]) => log("WARN", ...args),
  error: (...args: unknown[]) => log("ERROR", ...args),
  debug: (...args: unknown[]) => log("DEBUG", ...args),
};
