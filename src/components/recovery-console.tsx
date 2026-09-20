"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { RecoveryEntry } from "@/components/recovery-entry";
import { useApiAction } from "@/components/use-api-action";
import { presentApiError } from "@/lib/api-errors";
import { requestApi } from "@/lib/client-api";

type EmergencyAction = "LOCKDOWN" | "COMPLETE_RECOVERY" | "CHANGE_EMAIL" | "CHANGE_PHONE" | "ADD_KEY" | "REMOVE_KEY" | "ROTATE_RECOVERY" | "REVOKE_SESSIONS";
type RecoveryState = { emailVerified: boolean; phoneVerified: boolean; keys: Array<{ id: string; device_label: string; last_used_at: string | null }> };

async function api<T = Record<string, unknown>>(path: string, body: unknown, method = "POST") {
  return requestApi<T>(path, { method, body });
}

export function RecoveryConsole({ emergency }: { emergency: boolean }) {
  return emergency ? <EmergencyRepair /> : <RecoveryEntry />;
}

function EmergencyRepair() {
  const router = useRouter();
  const [state, setState] = useState<RecoveryState | null>(null);
  const [secret, setSecret] = useState("");
  const [keyLabel, setKeyLabel] = useState("Replacement security key");
  const { pending, perform, message, live } = useApiAction();

  async function refresh() {
    setState(await requestApi<RecoveryState>("/api/v1/recovery/emergency/state"));
  }

  useEffect(() => {
    let active = true;
    void requestApi<RecoveryState>("/api/v1/recovery/emergency/state")
      .then((data) => { if (active) setState(data); })
      .catch((error) => { if (active) { setState(null); presentApiError(error); } });
    return () => { active = false; };
  }, []);

  async function prove(action: EmergencyAction) {
    const begun = await api<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"]; proofId: string }>("/api/v1/recovery/emergency/assertion", { action });
    const assertion = await startAuthentication({ optionsJSON: begun.options });
    await api("/api/v1/recovery/emergency/assertion", { proofId: begun.proofId, response: assertion });
    return begun.proofId;
  }

  async function run(action: () => Promise<unknown>) {
    const completed = await perform(() => action().then(() => undefined), { en: "Recovery action completed and state refreshed.", ar: "اكتمل إجراء الاسترداد وتم تحديث الحالة." });
    if (completed) await refresh();
  }

  async function repairContact(element: HTMLFormElement) {
    const form = new FormData(element);
    const channel = form.get("channel") === "PHONE" ? "PHONE" : "EMAIL";
    await run(async () => api("/api/v1/recovery/emergency/contact", { proofId: await prove(channel === "EMAIL" ? "CHANGE_EMAIL" : "CHANGE_PHONE"), channel, destination: form.get("destination") }));
  }

  async function confirmContact(element: HTMLFormElement) {
    const form = new FormData(element);
    await run(() => api("/api/v1/recovery/emergency/contact", { channel: form.get("channel"), code: form.get("code") }));
  }

  async function addKey() {
    await run(async () => {
      const proofId = await prove("ADD_KEY");
      const options = await api<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/api/v1/recovery/emergency/keys", { proofId });
      const response = await startRegistration({ optionsJSON: options });
      return api("/api/v1/recovery/emergency/keys", { response, label: keyLabel });
    });
  }

  async function rotate() {
    await run(async () => {
      const result = await api<{ recoverySecret: string }>("/api/v1/recovery/emergency/recovery-secret", { proofId: await prove("ROTATE_RECOVERY") });
      setSecret(result.recoverySecret);
      return result;
    });
  }

  async function complete(element: HTMLFormElement) {
    const form = new FormData(element);
    await run(async () => {
      const result = await api("/api/v1/recovery/emergency/complete", { proofId: await prove("COMPLETE_RECOVERY"), password: form.get("password"), confirmation: form.get("confirmation"), savedCopyAcknowledged: form.get("saved") === "on", repairChecklistAcknowledged: form.get("checklist") === "on" });
      setSecret("");
      router.push("/account");
      return result;
    });
  }

  return <section className="panel">
    <h2>Restricted emergency session</h2>
    <p>This session cannot shop, manage orders, grant roles, inspect customers, or move money.</p>
    <p>Contacts: email {state?.emailVerified ? "verified" : "needs repair"} · phone {state?.phoneVerified ? "verified" : "needs repair"}</p>
    <div className="list">{state?.keys.map((key) => <article key={key.id}><strong>{key.device_label}</strong><small>{key.last_used_at ? "assertion tested" : "must be tested by a fresh assertion"}</small><button className="secondary" disabled={pending} onClick={() => void run(async () => api("/api/v1/recovery/emergency/keys", { proofId: await prove("REMOVE_KEY"), credentialId: key.id }, "DELETE"))}>Remove with another key</button></article>)}</div>
    <div className="quick-grid">
      <button className="secondary" disabled={pending} onClick={() => void run(async () => api("/api/v1/recovery/emergency/lockdown", { proofId: await prove("LOCKDOWN") }))}>Activate global lockdown</button>
      <button className="secondary" disabled={pending} onClick={() => void run(async () => api("/api/v1/recovery/emergency/sessions", { proofId: await prove("REVOKE_SESSIONS") }, "DELETE"))}>Revoke normal CTO sessions</button>
      <label>Replacement key label<input value={keyLabel} onChange={(event) => setKeyLabel(event.target.value)} maxLength={100} /></label>
      <button className="secondary" disabled={pending || !keyLabel} onClick={() => void addKey()}>Add replacement key</button>
      <button className="secondary" disabled={pending} onClick={() => void rotate()}>Generate replacement passphrase</button>
    </div>
    <details><summary>Repair email or phone</summary><form onSubmit={(event) => { event.preventDefault(); void repairContact(event.currentTarget); }}><select name="channel"><option value="EMAIL">Email</option><option value="PHONE">Phone</option></select><input name="destination" required placeholder="New verified destination" /><button className="secondary" disabled={pending}>Send protected verification</button></form><form onSubmit={(event) => { event.preventDefault(); void confirmContact(event.currentTarget); }}><select name="channel"><option value="EMAIL">Email</option><option value="PHONE">Phone</option></select><input name="code" required placeholder="Verification code" /><button className="secondary" disabled={pending}>Activate destination</button></form></details>
    {secret ? <output className="secret">{secret}</output> : null}
    <form onSubmit={(event) => { event.preventDefault(); void complete(event.currentTarget); }}><input name="password" type="password" minLength={12} required placeholder="New CTO password" /><textarea name="confirmation" autoComplete="off" required placeholder="Re-enter the generated 12-token passphrase" /><label className="check"><input name="saved" type="checkbox" required />I saved the replacement passphrase securely.</label><label className="check"><input name="checklist" type="checkbox" required />I inspected repaired contacts and tested keys; unresolved compromise checks are complete.</label><button className="primary" disabled={pending}>Finish recovery and return to normal login</button></form>
    <button className="ghost" disabled={pending} onClick={() => void run(() => api("/api/v1/recovery/emergency/sessions", { exit: true }, "DELETE"))}>Exit without unlocking</button>
    <p aria-live={live}>{message}</p>
  </section>;
}
