import "dotenv/config";

import { fetchBookings } from "./productive/bookings.js";
import { initClient } from "./productive/client.js";

interface ParsedArgs {
  date: string | null;
  debugClient: boolean;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
  return value;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(): ParsedArgs {
  let date: string | null = null;
  let debugClient = false;

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--date=")) {
      date = arg.slice(7);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.error(`Invalid date format: ${date}. Use YYYY-MM-DD.`);
        process.exit(1);
      }
      continue;
    }
    if (arg === "--debug-client") {
      debugClient = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npm run bookings [-- --date=YYYY-MM-DD]

Options:
  --date=YYYY-MM-DD   List bookings for this date (default: today)
  --debug-client      Print extra client-resolution details
  --help, -h          Show this help message`);
      process.exit(0);
    }

    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }

  return { date, debugClient };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const date = args.date ?? todayISO();
  const personId = requireEnv("PRODUCTIVE_PERSON_ID");

  initClient({
    apiToken: requireEnv("PRODUCTIVE_API_TOKEN"),
    orgId: requireEnv("PRODUCTIVE_ORG_ID"),
  });

  const bookings = await fetchBookings(personId, date);

  console.log(`Bookings for ${date}:`);
  if (bookings.length === 0) {
    console.log("No bookings found.");
    return;
  }

  for (const booking of bookings) {
    console.log(`- Booking name: ${booking.serviceName}`);
    console.log(`  Billed client: ${booking.billedClient ?? "Unknown"}`);
    console.log(`  Service number: ${booking.serviceNumber}`);
    console.log(`  Service ID (.productive): ${booking.serviceId}`);
    if (args.debugClient) {
      const source = booking.billedClient ? "deal.company" : "unresolved";
      console.log(`  Client source: ${source}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error("Failed to list bookings:", error);
  process.exit(1);
});
