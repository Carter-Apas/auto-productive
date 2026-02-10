// JSON:API base types

export interface JsonApiResource<T extends string = string, A = any> {
  id: string;
  type: T;
  attributes: A;
  relationships?: Record<
    string,
    {
      data:
        | { type: string; id: string }
        | { type: string; id: string }[]
        | null;
    }
  >;
}

export interface JsonApiResponse<T extends JsonApiResource = JsonApiResource> {
  data: T | T[];
  included?: JsonApiResource[];
  meta?: { total_count?: number; page?: { number: number; size: number } };
  links?: { next?: string; last?: string };
}

// Productive API resource types
export interface BookingAttributes {
  started_on: string;
  ended_on: string;
  time: number; // minutes per day
  percentage: number | null;
  total_time: number | null;
  booking_method_id: number; // 1=per day, 2=percentage, 3=total hours
}

export type BookingResource = JsonApiResource<"bookings", BookingAttributes>;

export interface ServiceAttributes {
  name: string;
  unit_id: number; // 1=hour, 2=piece, 3=day
  billing_type_id: number;
  estimated_time: number | null;
  budgeted_time: number | null;
  worked_time: number | null;
}

export type ServiceResource = JsonApiResource<"services", ServiceAttributes>;

export interface DealAttributes {
  name: string;
  budget: boolean;
  estimated_time: number | null;
  budgeted_time: number | null;
  worked_time: number | null;
}

export type DealResource = JsonApiResource<"deals", DealAttributes>;

export interface ProjectAttributes {
  name: string;
  number: number | null;
  project_type_id: number | null;
}

export type ProjectResource = JsonApiResource<"projects", ProjectAttributes>;

export interface TimeEntryAttributes {
  date: string;
  time: number; // minutes
  note: string | null;
}

export type TimeEntryResource = JsonApiResource<
  "time_entries",
  TimeEntryAttributes
>;

// Resolved booking with project info
export interface ResolvedBooking {
  bookingId: string;
  serviceId: string;
  dealId: string;
  projectId: string;
  projectName: string;
  serviceName: string;
  timeMinutes: number; // how many minutes booked for the day
}

// Git collector types
export interface GitCommit {
  hash: string;
  subject: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface RepoActivity {
  repoName: string;
  repoPath: string;
  commits: GitCommit[];
}

// Codex session types
export interface CodexSessionActivity {
  sessionId: string;
  projectPath: string; // session cwd
  sessionFile: string;
  summaries: string[]; // extracted user messages or summaries
}

// Matching types
export interface ProjectMatch {
  activity: RepoActivity | CodexSessionActivity;
  booking: ResolvedBooking;
  matchType: "manual";
}

export interface UnmatchedActivity {
  name: string;
  source: "git" | "codex";
}

// Config
export interface Config {
  productiveApiToken: string;
  productiveOrgId: string;
  productivePersonId: string;
  chatgptApiKey: string;
  chatgptModel: string;
  scanDirs: string[];
  gitAuthorName: string;
  codexSessionsDir: string;
  confirm: boolean;
  date: string; // YYYY-MM-DD
}
