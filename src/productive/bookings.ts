import { apiGet, apiGetWithIncluded } from "./client.js";

import { logger } from "../logger.js";
import type {
  BookingResource,
  JsonApiResource,
  ResolvedBooking,
} from "../types.js";

interface ResourceRef {
  type: string;
  id: string;
}

interface ResolveContext {
  included: Map<string, JsonApiResource>;
  fetched: Map<string, Promise<JsonApiResource | null>>;
}

export async function fetchBookings(
  personId: string,
  date: string
): Promise<ResolvedBooking[]> {
  logger.info(`Fetching bookings for person ${personId} on ${date}`);

  const { data: bookings, included } =
    await apiGetWithIncluded<BookingResource>("bookings", {
      "filter[person_id]": personId,
      "filter[after]": date,
      "filter[before]": date,
      include: "service,service.deal,service.deal.company",
    });

  if (bookings.length === 0) {
    logger.warn("No bookings found for this date");
    return [];
  }

  logger.info(`Found ${bookings.length} booking(s)`);

  const context: ResolveContext = {
    included: new Map(
      included.map((resource) => [resourceKey(resource), resource])
    ),
    fetched: new Map(),
  };

  const resolved: ResolvedBooking[] = [];

  for (const booking of bookings) {
    try {
      const serviceRef = getRelationshipRef(booking, "service");
      if (!serviceRef) {
        logger.warn(
          `Booking ${booking.id} has no service relationship, skipping`
        );
        continue;
      }

      const service = await getResource(serviceRef, context);
      if (!service) {
        logger.warn(
          `Booking ${booking.id} references missing service ${serviceRef.id}, skipping`
        );
        continue;
      }

      const serviceAttrs = toAttributes(service);
      const serviceName =
        readFirstString(serviceAttrs, ["name"]) ?? `Service ${service.id}`;

      const dealRef = getRelationshipRef(service, "deal");
      const deal = dealRef ? await getResource(dealRef, context) : null;
      const dealAttrs = deal ? toAttributes(deal) : {};

      const companyRef = deal ? getRelationshipRef(deal, "company") : null;
      const company = companyRef
        ? await getResource(companyRef, context)
        : null;
      const companyAttrs = company ? toAttributes(company) : {};

      const serviceNumber =
        readFirstNumberish(dealAttrs, ["number", "deal_number"]) ??
        readFirstNumberish(serviceAttrs, [
          "number",
          "service_number",
          "service_code",
          "code",
        ]) ??
        service.id;
      const billedClient =
        readFirstString(companyAttrs, ["billing_name", "name"]) ?? null;
      const timeMinutes = getBookingTimeForDay(booking);

      resolved.push({
        bookingId: booking.id,
        serviceId: service.id,
        serviceNumber,
        billedClient,
        dealId: deal?.id ?? service.id,
        projectId: deal?.id ?? service.id,
        projectName: serviceName,
        serviceName,
        timeMinutes,
      });

      logger.info(
        `  Booking: ${serviceName} — ${timeMinutes} min - service id: ${service.id}`
      );
    } catch (err) {
      logger.error(`Failed to resolve booking ${booking.id}:`, err);
    }
  }

  return resolved;
}

function resourceKey(resource: { type: string; id: string }): string {
  return `${resource.type}:${resource.id}`;
}

function toAttributes(resource: JsonApiResource): Record<string, unknown> {
  if (typeof resource.attributes === "object" && resource.attributes) {
    return resource.attributes as Record<string, unknown>;
  }
  return {};
}

function readFirstString(
  attributes: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function readFirstNumberish(
  attributes: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getRelationshipRef(
  resource: JsonApiResource,
  key: string
): ResourceRef | null {
  const relationship = resource.relationships?.[key]?.data;
  if (!relationship || Array.isArray(relationship)) {
    return null;
  }
  return relationship;
}

function asSingleResource(
  data: JsonApiResource | JsonApiResource[]
): JsonApiResource | null {
  if (Array.isArray(data)) {
    return data.length > 0 ? data[0] : null;
  }
  return data;
}

async function getResource(
  ref: ResourceRef,
  context: ResolveContext
): Promise<JsonApiResource | null> {
  const key = resourceKey(ref);
  const fromIncluded = context.included.get(key);
  if (fromIncluded) {
    return fromIncluded;
  }

  const fromFetched = context.fetched.get(key);
  if (fromFetched) {
    return fromFetched;
  }

  const pending = (async () => {
    try {
      const response = await apiGet<JsonApiResource>(`${ref.type}/${ref.id}`);
      return asSingleResource(response.data);
    } catch {
      return null;
    }
  })();
  context.fetched.set(key, pending);
  return pending;
}

function getBookingTimeForDay(booking: BookingResource): number {
  const { booking_method_id, time, total_time, percentage } =
    booking.attributes;

  switch (booking_method_id) {
    case 1:
      return time;
    case 2: {
      const pct = percentage ?? 100;
      return Math.round((pct / 100) * 480);
    }
    case 3: {
      if (!total_time) {
        return 480;
      }
      const start = new Date(booking.attributes.started_on);
      const end = new Date(booking.attributes.ended_on);
      const days = Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
        1
      );
      return Math.round(total_time / days);
    }
    default:
      return time || 480;
  }
}
