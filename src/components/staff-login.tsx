"use client";
import { startAuthentication } from "@simplewebauthn/browser";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import { requestApi } from "@/lib/client-api";
type AuthResponse = { mfaRequired?: boolean; options?: Parameters<typeof startAuthentication>[0]["optionsJSON"]; pendingToken?: string };
export function StaffLogin() {
  const { text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    const completed = await perform(async () => {
      const data = await requestApi<AuthResponse>("/api/v1/auth/login", { method: "POST", body: { email: values.get("email"), password: values.get("password") } });
      if (data.mfaRequired) {
        if (!data.options || !data.pendingToken) throw new Error("INVALID_RESPONSE");
        const assertion = await startAuthentication({ optionsJSON: data.options });
        await requestApi("/api/v1/auth/mfa", { method: "POST", body: { pendingToken: data.pendingToken, response: assertion } });
      }
    }, { en: "Signed in.", ar: "تم تسجيل الدخول." });
    if (completed) location.reload();
  }
  return <section className="panel"><h2>{text("Authorized staff sign in", "دخول الموظفين المصرّح لهم")}</h2><form onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}><label>{text("Email", "البريد الإلكتروني")}<input name="email" type="email" required /></label><label>{text("Password", "كلمة المرور")}<input name="password" type="password" minLength={12} required /></label><button className="primary" disabled={pending}>{text(pending ? "Continuing…" : "Continue", pending ? "جارٍ المتابعة…" : "متابعة")}</button></form><p aria-live={live}>{message}</p></section>;
}
