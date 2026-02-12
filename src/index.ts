import { createInterface } from "node:readline/promises";

import { loadConfig } from "./config.js";
import { collectCodexActivity } from "./collectors/codex-sessions.js";
import { collectGitActivity } from "./collectors/git.js";
import { formatNoteWithChatGPT } from "./formatting/chatgpt.js";
import { logger } from "./logger.js";
import { formatNotes } from "./notes.js";
import { fetchBookings } from "./productive/bookings.js";
import { initClient } from "./productive/client.js";
import { createTimeEntry } from "./productive/time-entries.js";
import {
  isPathWithinAnyFolder,
  discoverServiceFolders,
} from "./service-folders.js";
import type { ProjectMatch } from "./types.js";

type SubmissionDecision = "submit" | "skip" | "cancel";
type PromptInterface = ReturnType<typeof createInterface>;
interface PromptResult {
  decision: SubmissionDecision;
  note: string;
}

async function promptForEditedNote(
  rl: PromptInterface,
  existingNote: string
): Promise<string> {
  console.log("\n━━━ Edit Note ━━━");
  console.log(
    "Enter the full replacement note. End input with a single '.' on its own line."
  );
  console.log("Leave it empty and enter '.' to keep the existing note.");

  const lines: string[] = [];
  while (true) {
    const line = await rl.question("note> ");
    if (line.trim() === ".") {
      break;
    }
    lines.push(line);
  }

  const nextNote = lines.join("\n").trim();
  if (!nextNote) {
    logger.info("  Kept existing note.");
    return existingNote;
  }

  logger.info("  Updated note.");
  return nextNote;
}

async function promptBeforeSubmit(
  rl: PromptInterface,
  bookingName: string,
  timeMinutes: number,
  note: string
): Promise<PromptResult> {
  let currentNote = note;

  while (true) {
    console.log(`\n━━━ Ready To Submit: ${bookingName} (${timeMinutes} min) ━━━`);
    console.log(currentNote || "(no activity notes)");

    const answer = (
      await rl.question(
        "Submit this entry? [y]es / [e]dit note / [s]kip / [c]ancel remaining: "
      )
    )
      .trim()
      .toLowerCase();

    if (answer === "y" || answer === "yes") {
      return { decision: "submit", note: currentNote };
    }
    if (answer === "e" || answer === "edit") {
      currentNote = await promptForEditedNote(rl, currentNote);
      continue;
    }
    if (answer === "s" || answer === "skip") {
      return { decision: "skip", note: currentNote };
    }
    if (answer === "c" || answer === "cancel") {
      return { decision: "cancel", note: currentNote };
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig();

  logger.info(
    `auto-productive starting for ${config.date}${config.confirm ? " (CONFIRM)" : ""}`
  );

  // Initialize API client
  initClient({
    apiToken: config.productiveApiToken,
    orgId: config.productiveOrgId,
  });

  // Step 1: Fetch bookings and resolve to projects
  const bookings = await fetchBookings(config.productivePersonId, config.date);
  if (bookings.length === 0) {
    logger.info("No bookings found — nothing to do");
    return;
  }

  const serviceFolders = await discoverServiceFolders(config.scanDirs);
  const mappedFolderCount = [...serviceFolders.values()].reduce(
    (sum, folders) => sum + folders.length,
    0
  );
  logger.info(
    `Found ${mappedFolderCount} folder(s) with .productive across ${serviceFolders.size} service id(s)`
  );
  const mappedFolders = [...new Set([...serviceFolders.values()].flat())];

  // Step 2: Collect activity data
  const [gitActivities, codexActivities] = await Promise.all([
    collectGitActivity(mappedFolders, config.gitAuthorName, config.date),
    collectCodexActivity(config.codexSessionsDir, config.scanDirs, config.date),
  ]);

  let created = 0;
  let skipped = 0;
  const failed = 0;
  let bookingsWithoutFolders = 0;
  let bookingsWithNoActivity = 0;
  let cancelled = false;

  const rl = config.confirm
    ? createInterface({ input: process.stdin, output: process.stdout })
    : null;

  try {
    for (const booking of bookings) {
      const folders = serviceFolders.get(booking.serviceId) ?? [];
      if (folders.length === 0) {
        bookingsWithoutFolders++;
        logger.warn(
          `No .productive folder found for booking service_id ${booking.serviceId} (${booking.serviceName})`
        );
      }

      const matches: ProjectMatch[] = [];
      const seenRepos = new Set<string>();
      const seenSessions = new Set<string>();

      for (const repo of gitActivities) {
        if (!isPathWithinAnyFolder(repo.repoPath, folders)) {
          continue;
        }
        if (seenRepos.has(repo.repoPath)) {
          continue;
        }
        seenRepos.add(repo.repoPath);
        matches.push({ activity: repo, booking, matchType: "manual" });
      }

      for (const session of codexActivities) {
        if (!isPathWithinAnyFolder(session.projectPath, folders)) {
          continue;
        }
        if (seenSessions.has(session.sessionId)) {
          continue;
        }
        seenSessions.add(session.sessionId);
        matches.push({ activity: session, booking, matchType: "manual" });
      }

      if (matches.length === 0) {
        bookingsWithNoActivity++;
      }

      const rawNote = formatNotes(matches);
      let note = await formatNoteWithChatGPT(
        rawNote,
        booking.projectName,
        config.chatgptApiKey,
        config.chatgptModel
      );

      if (rl) {
        const promptResult = await promptBeforeSubmit(
          rl,
          `${booking.projectName} / ${booking.serviceName}`,
          booking.timeMinutes,
          note
        );
        note = promptResult.note;
        if (promptResult.decision === "skip") {
          skipped++;
          logger.info(
            `  Skipping ${booking.projectName} / ${booking.serviceName} by user choice`
          );
          continue;
        }
        if (promptResult.decision === "cancel") {
          cancelled = true;
          logger.warn("Submission cancelled by user.");
          break;
        }
      }

      const success = await createTimeEntry(
        config.productivePersonId,
        config.date,
        booking,
        note
      );

      if (success) {
        created++;
      } else {
        // Could be skipped (already exists) or failed; createTimeEntry logs reason.
        skipped++;
      }
    }
  } finally {
    rl?.close();
  }

  logger.info("━━━ Summary ━━━");
  logger.info(`Bookings: ${bookings.length}`);
  logger.info(`Service IDs with .productive folders: ${serviceFolders.size}`);
  logger.info(`Folders with .productive: ${mappedFolderCount}`);
  logger.info(`Git repos with activity: ${gitActivities.length}`);
  logger.info(`Codex sessions with activity: ${codexActivities.length}`);
  logger.info(`Bookings without mapped folders: ${bookingsWithoutFolders}`);
  logger.info(`Bookings with no activity: ${bookingsWithNoActivity}`);
  if (cancelled) {
    logger.warn("Run ended early due to user cancellation.");
  }

  logger.info(`Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error("Fatal error:", err);
  process.exit(1);
});
