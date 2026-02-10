import { apiGet, apiGetWithIncluded } from "./client.js";

import { logger } from "../logger.js";
import type {
  BookingResource,
  JsonApiResource,
  ResolvedBooking,
  ServiceResource,
} from "../types.js";

export async function fetchBookings(
  personId: string,
  date: string,
): Promise<ResolvedBooking[]> {
  logger.info(`Fetching bookings for person ${personId} on ${date}`);

  // Fetch bookings that overlap with the target date, including related service
  const { data: bookings, included } =
    await apiGetWithIncluded<BookingResource>("bookings", {
      "filter[person_id]": personId,
      "filter[after]": date,
      "filter[before]": date,
      include: "service",
    });

  if (bookings.length === 0) {
    logger.warn("No bookings found for this date");
    return [];
  }

  logger.info(`Found ${bookings.length} booking(s)`);

  // Build a map of included resources for quick lookup
  const includedMap = new Map<string, JsonApiResource>();
  for (const resource of included) {
    includedMap.set(`${resource.type}:${resource.id}`, resource);
  }

  const resolved: ResolvedBooking[] = [];

  for (const booking of bookings) {
    try {
      const serviceRef = booking.relationships?.service?.data;
      if (!serviceRef || Array.isArray(serviceRef)) {
        logger.warn(
          `Booking ${booking.id} has no service relationship, skipping`,
        );
        continue;
      }

      // Get service - might be in included, otherwise fetch
      let service = includedMap.get(`services:${serviceRef.id}`) as
        | ServiceResource
        | undefined;
      if (!service) {
        const serviceResp = await apiGet<ServiceResource>(
          `services/${serviceRef.id}`,
        );
        service = Array.isArray(serviceResp.data)
          ? serviceResp.data[0]
          : serviceResp.data;
      }

      // Calculate time for the day
      const timeMinutes = getBookingTimeForDay(booking);

      resolved.push({
        bookingId: booking.id,
        serviceId: service.id,
        dealId: service.id,
        projectId: service.id,
        projectName: service.attributes.name,
        serviceName: service.attributes.name,
        timeMinutes,
      });

      logger.info(
        `  Booking: ${service.attributes.name} — ${timeMinutes} min - id: ${service.id}`,
      );
    } catch (err) {
      logger.error(`Failed to resolve booking ${booking.id}:`, err);
    }
  }

  return resolved;
}

function getBookingTimeForDay(booking: BookingResource): number {
  const { booking_method_id, time, total_time, percentage } =
    booking.attributes;

  switch (booking_method_id) {
    case 1: // Per day - time is minutes per day
      return time;
    case 2: {
      // Percentage of an 8-hour day
      const pct = percentage ?? 100;
      return Math.round((pct / 100) * 480);
    }
    case 3: {
      // Total hours spread across the booking period
      if (!total_time) {
        return 480;
      }
      const start = new Date(booking.attributes.started_on);
      const end = new Date(booking.attributes.ended_on);
      const days = Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
          1,
      );
      return Math.round(total_time / days);
    }
    default:
      return time || 480;
  }
}
