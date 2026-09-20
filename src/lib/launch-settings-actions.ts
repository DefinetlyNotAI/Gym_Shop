import { ApiFailure, readApiData } from "@/lib/api-errors";

type Transport = typeof fetch;
type LaunchSetting = "checkout.tax_policy" | "delivery.cod_redelivery_policy_reviewed" | "platform.store_enabled";

async function post(path: string, body: unknown, transport: Transport) {
  return readApiData<unknown>(await transport(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
}

export async function updateLaunchSetting(key: LaunchSetting, value: "NONE_REVIEWED" | boolean, reason: string, transport: Transport = fetch): Promise<void> {
  const note = reason.trim();
  if (!note || note.length > 500) throw new ApiFailure("SETTING_UPDATE_INVALID", 400);
  const data = await post("/api/v1/admin/settings", { key, value, reason: note }, transport);
  if (!data || typeof data !== "object" || (data as { updated?: unknown }).updated !== true) throw new ApiFailure("INVALID_RESPONSE");
}

export type TermsInput = { version: string; titleEn: string; bodyEn: string; titleAr: string; bodyAr: string };
export async function publishBilingualTerms(input: TermsInput, transport: Transport = fetch): Promise<{ published: number }> {
  const value = Object.fromEntries(Object.entries(input).map(([key, item]) => [key, item.trim()])) as TermsInput;
  if (!value.version || value.version.length > 100 || value.titleEn.length < 2 || value.titleAr.length < 2 || value.bodyEn.length < 10 || value.bodyAr.length < 10) throw new ApiFailure("TERMS_CREATE_INVALID", 400);
  const data = await post("/api/v1/admin/terms", { kind: "TERMS", ...value, publish: true }, transport);
  if (!Array.isArray(data) || data.length !== 2 || data.some((item) => !item || typeof item !== "object" || typeof item.id !== "string")) throw new ApiFailure("INVALID_RESPONSE");
  return { published: data.length };
}

export async function recordRecoveryDrill(input: { result: "PASSED" | "FAILED"; notes: string }, transport: Transport = fetch): Promise<{ evidenceId: string }> {
  const notes = input.notes.trim();
  if (!["PASSED", "FAILED"].includes(input.result) || notes.length < 10 || notes.length > 2000) throw new ApiFailure("EVIDENCE_INVALID", 400);
  const data = await post("/api/v1/admin/readiness", { result: input.result, notes }, transport);
  if (!data || typeof data !== "object" || typeof (data as { evidenceId?: unknown }).evidenceId !== "string") throw new ApiFailure("INVALID_RESPONSE");
  return { evidenceId: (data as { evidenceId: string }).evidenceId };
}
