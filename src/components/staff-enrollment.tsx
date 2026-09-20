"use client";
import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { useApiAction } from "@/components/use-api-action";
import { requestApi } from "@/lib/client-api";
type RegistrationOptions = Parameters<typeof startRegistration>[0]["optionsJSON"];
export function StaffEnrollment() {
  const [token, setToken] = useState("");
  const [keyLabel, setKeyLabel] = useState("");
  const [independent, setIndependent] = useState(false);
  const { pending, perform, message, live } = useApiAction();
  async function key() {
    await perform(async () => {
      const options = await requestApi<RegistrationOptions>("/api/v1/staff-enrollment/webauthn/options", { method: "POST", body: { token } });
      const response = await startRegistration({ optionsJSON: options });
      await requestApi("/api/v1/staff-enrollment/webauthn/verify", { method: "POST", body: { token, response, label: keyLabel, independent } });
    }, { en: "Security key registered. Management roles must add a separate spare too.", ar: "تم تسجيل مفتاح الأمان. يجب على أدوار الإدارة إضافة مفتاح احتياطي منفصل أيضاً." });
  }
  async function finish(form: HTMLFormElement) {
    const password = new FormData(form).get("password");
    const completed = await perform(() => requestApi("/api/v1/staff-enrollment/complete", { method: "POST", body: { token, password } }).then(() => undefined), { en: "Enrollment complete. Sign in with your security key.", ar: "اكتمل التسجيل. سجّل الدخول باستخدام مفتاح الأمان." });
    if (completed) form.reset();
  }
  return <section className="panel"><label>Invitation token<input value={token} onChange={(event) => setToken(event.target.value)} /></label><label>Security key name<input value={keyLabel} minLength={2} onChange={(event) => setKeyLabel(event.target.value)} /></label><label className="check"><input type="checkbox" checked={independent} onChange={(event) => setIndependent(event.target.checked)} />This is a physically independent key stored separately.</label><button className="secondary" disabled={pending || !token || keyLabel.trim().length < 2 || !independent} onClick={() => void key()}>Register security key</button><form onSubmit={(event) => { event.preventDefault(); void finish(event.currentTarget); }}><label>Password<input name="password" type="password" minLength={12} required /></label><button className="primary" disabled={pending || !token}>Complete enrollment</button></form><p aria-live={live}>{message}</p></section>;
}
