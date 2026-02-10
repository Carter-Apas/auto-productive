import { apiGetAll } from "./client.js";

import { logger } from "../logger.js";
import type { ProjectResource } from "../types.js";

export async function fetchProjects(): Promise<ProjectResource[]> {
  logger.info("Fetching project list");
  const projects = await apiGetAll<ProjectResource>("projects", {
    "filter[status]": "1", // active projects only
  });
  logger.info(`Found ${projects.length} active project(s)`);
  return projects;
}
