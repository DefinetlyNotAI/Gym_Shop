"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import { errorNotice, presentApiError } from "@/lib/api-errors";
import { requestApi } from "@/lib/client-api";

type AuthResponse = { mfaRequired?: boolean; options?: Parameters<typeof startAuthentication>[0]["optionsJSON"]; pendingToken?: string; developmentVerificationToken?: string };

export function AuthPanel({ terms }: { terms: { id: string; version: string; title: string } | null }) {
  const { text, language } = useLanguage();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [developmentToken, setDevelopmentToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { pending, perform, message, live } = useApiAction();
  const search = useSearchParams();
  useEffect(() => {
    const token = search.get("verifyEmail");
    if (!token) return;
    let active = true;
    void requestApi("/api/v1/auth/verify-email", { method: "POST", body: { token } })
      .then(() => { if (active) setVerificationMessage(language === "ar" ? "تم تأكيد البريد. يمكنك تسجيل الدخول." : "Email verified. You can sign in."); })
      .catch((error) => { if (active) { presentApiError(error); setVerificationMessage(errorNotice(error).description[language]); } });
    return () => { active = false; };
  }, [language, search]);
  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    let verificationToken = "";
    const completed = await perform(async () => {
      const body = mode === "login" ? { email: values.get("email"), password: values.get("password") } : { email: values.get("email"), password: values.get("password"), displayName: values.get("name"), termsDocumentId: terms?.id, language, marketing: values.get("marketing") === "on" };
      const data = await requestApi<AuthResponse>(`/api/v1/auth/${mode}`, { method: "POST", body });
      if (mode === "login" && data.mfaRequired && data.options && data.pendingToken) {
        const assertion = await startAuthentication({ optionsJSON: data.options });
        await requestApi("/api/v1/auth/mfa", { method: "POST", body: { pendingToken: data.pendingToken, response: assertion } });
      }
      verificationToken = data.developmentVerificationToken ?? "";
    }, mode === "login" ? { en: "Signed in.", ar: "تم تسجيل الدخول." } : { en: "Account created. Check your verification message.", ar: "تم إنشاء الحساب. تحقق من رسالة التأكيد." });
    if (!completed) return;
    if (mode === "login") location.reload();
    else {
      setDevelopmentToken(verificationToken);
      setDisplayName("");
      setEmail("");
      setPassword("");
      form.reset();
    }
  }
  return <section className="panel"><div className="tabs"><button aria-pressed={mode === "login"} disabled={pending} onClick={() => setMode("login")}>{text("Sign in", "دخول")}</button><button aria-pressed={mode === "register"} disabled={pending} onClick={() => setMode("register")}>{text("Create account", "حساب جديد")}</button></div><form onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>{mode === "register" ? <label>{text("Name", "الاسم")}<input name="name" required minLength={2} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label> : null}<label>{text("Email", "البريد")}<input name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>{text("Password", "كلمة المرور")}<input name="password" type="password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} /></label>{mode === "register" ? <>{terms ? <><article className="notice"><strong>{terms.title}</strong><span>{text("Version", "الإصدار")} {terms.version}</span></article><label className="check"><input name="accept" type="checkbox" required />{text("I accept this version", "أوافق على هذه النسخة")}</label></> : <p className="alert">{text("Registration is unavailable until reviewed terms are published.", "التسجيل غير متاح حتى نشر الشروط المعتمدة.")}</p>}<label className="check"><input name="marketing" type="checkbox" />{text("Optional marketing", "تسويق اختياري")}</label></> : null}<button className="primary" type="submit" disabled={pending || (mode === "register" && !terms)}>{text(pending ? "Continuing…" : "Continue", pending ? "جارٍ المتابعة…" : "متابعة")}</button></form>{developmentToken ? <output className="secret">{text("Local verification token", "رمز التحقق المحلي")}: {developmentToken}</output> : null}<p aria-live="polite">{verificationMessage}</p><p aria-live={live}>{message}</p></section>;
}
