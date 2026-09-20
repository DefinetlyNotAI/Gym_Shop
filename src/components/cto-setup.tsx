"use client";

import { useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useApiAction } from "@/components/use-api-action";
import { requestApi } from "@/lib/client-api";

type RegistrationOptions = Parameters<typeof startRegistration>[0]["optionsJSON"];
type AuthenticationOptions = Parameters<typeof startAuthentication>[0]["optionsJSON"];

export function CtoSetup() {
  const [token, setToken] = useState("");
  const [keyLabel, setKeyLabel] = useState("Primary security key");
  const [independentKey, setIndependentKey] = useState(false);
  const [phone, setPhone] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verificationHint, setVerificationHint] = useState("");
  const { pending, perform, message, live } = useApiAction();

  async function registerKey() {
    await perform(async () => {
      const options = await requestApi<RegistrationOptions>("/api/v1/setup/webauthn/options", { method: "POST", body: { token } });
      const response = await startRegistration({ optionsJSON: options });
      await requestApi("/api/v1/setup/webauthn/verify", { method: "POST", body: { token, response, label: keyLabel, independentKeyAcknowledged: independentKey } });
    }, { en: "Security key registered. Register and test the physically separate spare too.", ar: "تم تسجيل مفتاح الأمان. سجّل المفتاح الاحتياطي المنفصل فعلياً واختبره أيضاً." });
  }

  async function assertKey() {
    await perform(async () => {
      const options = await requestApi<AuthenticationOptions>("/api/v1/setup/webauthn/assertion", { method: "POST", body: { token } });
      const response = await startAuthentication({ optionsJSON: options });
      await requestApi("/api/v1/setup/webauthn/assertion", { method: "POST", body: { token, response } });
    }, { en: "Security-key assertion passed. Repeat the test with the spare key.", ar: "نجح اختبار مفتاح الأمان. كرر الاختبار باستخدام المفتاح الاحتياطي." });
  }

  async function sendContact(channel: "EMAIL" | "PHONE") {
    await perform(async () => {
      const result = await requestApi<{ developmentCode?: string }>("/api/v1/setup/contact", { method: "POST", body: { token, channel, phone: channel === "PHONE" ? phone : undefined } });
      setVerificationHint(result.developmentCode ? `Local ${channel.toLowerCase()} code: ${result.developmentCode}` : "Verification code queued securely.");
    }, { en: "Verification code sent.", ar: "تم إرسال رمز التحقق." });
  }

  async function confirmContact(channel: "EMAIL" | "PHONE") {
    const code = channel === "EMAIL" ? emailCode : phoneCode;
    await perform(async () => {
      await requestApi("/api/v1/setup/contact", { method: "POST", body: { token, channel, code } });
      setVerificationHint("");
    }, { en: `${channel === "EMAIL" ? "Email" : "Phone"} verified.`, ar: `تم تأكيد ${channel === "EMAIL" ? "البريد الإلكتروني" : "الهاتف"}.` });
  }

  async function generateSecret() {
    await perform(async () => {
      const result = await requestApi<{ recoverySecret: string }>("/api/v1/setup/recovery-secret", { method: "POST", body: { token } });
      setSecret(result.recoverySecret);
    }, { en: "Save this passphrase now. It will not be shown again.", ar: "احفظ عبارة الاسترداد الآن، فلن تظهر مرة أخرى." });
  }

  async function finish(element: HTMLFormElement) {
    const form = new FormData(element);
    const completed = await perform(async () => {
      await requestApi("/api/v1/setup/complete", { method: "POST", body: { token, password: form.get("password"), recoverySecretConfirmation: form.get("confirmation"), savedCopyAcknowledged: form.get("saved") === "on" } });
    }, { en: "CTO setup complete. Sign in with MFA.", ar: "اكتمل إعداد حساب المدير التقني. سجّل الدخول بالمصادقة متعددة العوامل." });
    if (completed) setSecret("");
  }

  return <section className="panel">
    <div className="section-heading"><div><span className="eyebrow">Secure enrollment</span><h2>Configure the CTO account</h2></div><span className="status pending">One-time setup</span></div>
    <p className="muted">Complete every checkpoint with the one-use setup token. Values stay in place if a request needs correction.</p>
    <label>One-use setup token<input value={token} onChange={(event) => setToken(event.target.value)} autoComplete="one-time-code" required /></label>
    <div className="split-grid">
      <fieldset><legend>1. Independent security keys</legend>
        <label>Key label<input value={keyLabel} onChange={(event) => setKeyLabel(event.target.value)} maxLength={100} required /></label>
        <label className="check"><input type="checkbox" checked={independentKey} onChange={(event) => setIndependentKey(event.target.checked)} />This key is physically independent and stored separately.</label>
        <div className="action-row"><button className="secondary" disabled={pending || !token || !keyLabel || !independentKey} onClick={() => void registerKey()}>Register this key</button><button className="ghost" disabled={pending || !token} onClick={() => void assertKey()}>Test a registered key</button></div>
      </fieldset>
      <fieldset><legend>2. Verify recovery contacts</legend><div className="form-stack">
        <div className="action-row compact"><input value={emailCode} onChange={(event) => setEmailCode(event.target.value)} placeholder="Email verification code" autoComplete="one-time-code" /><button className="ghost" disabled={pending || !token} onClick={() => void sendContact("EMAIL")}>Send email code</button><button className="secondary" disabled={pending || !emailCode} onClick={() => void confirmContact("EMAIL")}>Verify email</button></div>
        <label>Jordan phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+9627…" inputMode="tel" /></label>
        <div className="action-row compact"><input value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} placeholder="Phone verification code" autoComplete="one-time-code" /><button className="ghost" disabled={pending || !token || !phone} onClick={() => void sendContact("PHONE")}>Send phone code</button><button className="secondary" disabled={pending || !phoneCode} onClick={() => void confirmContact("PHONE")}>Verify phone</button></div>
      </div></fieldset>
    </div>
    <fieldset><legend>3. Recovery passphrase and password</legend>
      <button className="secondary" disabled={pending || !token} onClick={() => void generateSecret()}>Generate one-time recovery passphrase</button>
      {secret ? <output className="secret" aria-live="polite">{secret}</output> : null}
      <form onSubmit={(event) => { event.preventDefault(); void finish(event.currentTarget); }}><label>Strong password<input name="password" type="password" minLength={12} required /></label><label>Re-enter all 12 tokens from the saved copy<textarea name="confirmation" autoComplete="off" required /></label><label className="check"><input name="saved" type="checkbox" required />I saved the passphrase separately and both physically independent keys passed an assertion.</label><button className="primary" disabled={pending || !token}>Complete secure setup</button></form>
    </fieldset>
    {verificationHint ? <p className="notice">{verificationHint}</p> : null}<p aria-live={live}>{message}</p>
  </section>;
}
