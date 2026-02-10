import { logger } from "../logger.js";
import type { JsonApiResource, JsonApiResponse } from "../types.js";

const BASE_URL = "https://api.productive.io/api/v2";

interface ClientConfig {
  apiToken: string;
  orgId: string;
}

let clientConfig: ClientConfig | null = null;

export function initClient(config: ClientConfig): void {
  clientConfig = config;
}

function getHeaders(): Record<string, string> {
  if (!clientConfig) {
    throw new Error("Client not initialized. Call initClient first.");
  }
  return {
    "Content-Type": "application/vnd.api+json",
    "X-Auth-Token": clientConfig.apiToken,
    "X-Organization-Id": clientConfig.orgId,
  };
}

export async function apiGet<T extends JsonApiResource>(
  path: string,
  params?: Record<string, string>,
): Promise<JsonApiResponse<T>> {
  const url = new URL(`${BASE_URL}/${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  logger.debug(`GET ${url.toString()}`);
  const response = await fetch(url.toString(), { headers: getHeaders() });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API GET ${path} failed (${response.status}): ${body}`);
  }

  return (await response.json()) as JsonApiResponse<T>;
}

export async function apiGetAll<T extends JsonApiResource>(
  path: string,
  params?: Record<string, string>,
): Promise<T[]> {
  const allData: T[] = [];
  let page = 1;
  const pageSize = "200";

  while (true) {
    const response = await apiGet<T>(path, {
      ...params,
      "page[number]": String(page),
      "page[size]": pageSize,
    });

    const data = Array.isArray(response.data) ? response.data : [response.data];
    allData.push(...data);

    if (!response.links?.next || data.length < Number(pageSize)) {
      break;
    }
    page++;
  }

  return allData;
}

export async function apiGetWithIncluded<T extends JsonApiResource>(
  path: string,
  params?: Record<string, string>,
): Promise<{ data: T[]; included: JsonApiResource[] }> {
  const allData: T[] = [];
  const allIncluded: JsonApiResource[] = [];
  let page = 1;
  const pageSize = "200";

  while (true) {
    const response = await apiGet<T>(path, {
      ...params,
      "page[number]": String(page),
      "page[size]": pageSize,
    });

    const data = Array.isArray(response.data) ? response.data : [response.data];
    allData.push(...data);
    if (response.included) {
      allIncluded.push(...response.included);
    }

    if (!response.links?.next || data.length < Number(pageSize)) {
      break;
    }
    page++;
  }

  return { data: allData, included: allIncluded };
}

export async function apiPost<T extends JsonApiResource>(
  path: string,
  body: unknown,
): Promise<JsonApiResponse<T>> {
  const url = `${BASE_URL}/${path}`;

  logger.debug(`POST ${url}`);
  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API POST ${path} failed (${response.status}): ${text}`);
  }

  return (await response.json()) as JsonApiResponse<T>;
}
