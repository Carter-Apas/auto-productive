import { apiGetAll, apiPost } from "./client.js";

import { logger } from "../logger.js";
import type { ResolvedBooking, TimeEntryResource } from "../types.js";

export async function getExistingEntries(
  personId: string,
  date: string,
): Promise<TimeEntryResource[]> {
  return apiGetAll<TimeEntryResource>("time_entries", {
    "filter[person_id]": personId,
    "filter[after]": date,
    "filter[before]": date,
  });
}

export function findExistingEntry(
  existing: TimeEntryResource[],
  serviceId: string,
): TimeEntryResource | undefined {
  return existing.find((entry) => {
    const serviceRef = entry.relationships?.service?.data;
    return (
      serviceRef && !Array.isArray(serviceRef) && serviceRef.id === serviceId
    );
  });
}

export async function createTimeEntry(
  personId: string,
  date: string,
  booking: ResolvedBooking,
  note: string,
): Promise<boolean> {
  const existing = await getExistingEntries(personId, date);
  const alreadyExists = findExistingEntry(existing, booking.serviceId);

  if (alreadyExists) {
    logger.info(
      `  Skipping ${booking.projectName} / ${booking.serviceName} — entry already exists (id: ${alreadyExists.id})`,
    );
    return false;
  }

  const body = {
    data: {
      type: "time_entries",
      attributes: {
        date,
        time: booking.timeMinutes,
        note,
      },
      relationships: {
        person: { data: { type: "people", id: personId } },
        service: { data: { type: "services", id: booking.serviceId } },
      },
    },
  };

  try {
    const result = await apiPost<TimeEntryResource>("time_entries", body);
    const entry = Array.isArray(result.data) ? result.data[0] : result.data;
    logger.info(
      `  Created entry for ${booking.projectName} / ${booking.serviceName} — ${booking.timeMinutes} min (id: ${entry.id})`,
    );
    return true;
  } catch (err) {
    logger.error(`  Failed to create entry for ${booking.projectName}:`, err);
    return false;
  }
}
