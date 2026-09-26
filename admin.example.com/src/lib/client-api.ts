import { ApiFailure, readApiData } from "@/lib/api-errors";
type Transport = typeof fetch;
type RequestOptions = Omit<RequestInit, "body" | "headers"> & { body?: unknown };
export async function requestApi<T>(path: string, options: RequestOptions = {}, transport: Transport = fetch): Promise<T> {
  if (!path.startsWith("/api/v1/") || path.startsWith("/api/v1//")) throw new ApiFailure("API_PATH_REJECTED", 400);
  return readApiData<T>(await transport(path, { ...options, headers: options.body === undefined ? undefined : { "content-type": "application/json" }, body: options.body === undefined ? undefined : JSON.stringify(options.body) }));
}
