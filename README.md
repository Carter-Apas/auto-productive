# auto-productive

Automatically creates Productive time entries from local activity.

The app:
- pulls bookings for a single date,
- maps each booking to one or more local folders via `.productive` files,
- collects Git + Codex activity for those folders,
- formats the note with ChatGPT,
- creates (or skips) the Productive time entry.

## How It Works

### 1. Fetch bookings
For the configured person/date, the app fetches all bookings from Productive.
Each booking is resolved from the `service` relationship and keeps:
- `bookingId`
- `serviceId`
- `serviceName`
- `timeMinutes` for that day

### 2. Discover service mappings from `.productive`
The app recursively scans `SCAN_DIRS` for folders containing a `.productive` file.

`.productive` format:
- plain text
- numeric `service_id` only
- example: `123456`

Multiple folders can map to the same `service_id`. All of them are used.

### 3. Collect activity for the date
- Git activity:
  - scans repos under `SCAN_DIRS`
  - runs `git log` for the configured author and day window
  - author matching is case-insensitive
- Codex activity:
  - reads JSONL sessions from `CODEX_SESSIONS_DIR/YYYY/MM/DD`
  - only includes sessions whose `cwd` is under `SCAN_DIRS`

### 4. Build one note per booking
For each booking:
- find mapped folders for `booking.serviceId`
- include all Git repos under those folders
- include all Codex sessions under those folders
- format note markdown (`Git Activity`, `Codex Sessions`)
- send note through ChatGPT formatter

### 5. Submit time entry
Before creating, app checks existing entries for that person/date and skips if same `service_id` already exists.

Then creates a Productive `time_entries` record with:
- `date`
- `time` (booking minutes)
- `note`
- `person`
- `service`

## Environment Variables

Required:
- `PRODUCTIVE_API_TOKEN`
  - Productive API token (`X-Auth-Token`).
- `PRODUCTIVE_ORG_ID`
  - Productive organization id (`X-Organization-Id`).
- `PRODUCTIVE_PERSON_ID`
  - Person id whose bookings/time entries are processed.
- `SCAN_DIRS`
  - Comma-separated root folders to scan for repos and `.productive` files.
  - Example: `/home/carter/project_folders,home/carter/more_project_folders`
- `GIT_AUTHOR_NAME`
  - Value used in `git log --author=...` (case-insensitive match).
- `CODEX_SESSIONS_DIR`
  - Root Codex sessions dir (typically `~/.codex/sessions`).
- `OPENAI_API_KEY` or `CHATGPT_API_KEY`
  - API key for note formatting.

Optional:
- `CHATGPT_MODEL`
  - Model for formatting notes.
  - Default: `gpt-4o-mini`
- `GIT_SCAN_DIRS`
  - Backward-compatible fallback if `SCAN_DIRS` is not set.

See `.env.example` for a template.

## CLI

```bash
auto-productive [options]
```

Options:
- `--confirm`
  - Prompt before each submission: yes, skip, or cancel remaining.
- `--date=YYYY-MM-DD`
  - Run for a specific date.
- `--help`
  - Show help.

## NPM Scripts

- `npm run dev`
  - Run for today (no prompt flag).
- `npm run dev:confirm`
  - Run for today with submit prompts.
- `npm run start`
  - Runs with `--confirm`.
- `npm test`
  - Run tests.
- `npm run build`
  - TypeScript build.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env`:
```bash
cp .env.example .env
```

3. Set `.productive` files in relevant folders:
```text
/path/to/repo/.productive
123456
```

4. Run:
```bash
npm run dev:confirm
```

## Notes

- If ChatGPT formatting fails, the app falls back to the raw generated note.
- Invalid `.productive` contents are ignored and logged as warnings.
- The app processes all bookings returned for the date, even when no mapped folders/activity exist for some bookings.
