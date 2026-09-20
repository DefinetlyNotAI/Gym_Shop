"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import { requestApi } from "@/lib/client-api";

export function PasswordReset() {
  const { text } = useLanguage();
  const search = useSearchParams();
  const { pending, perform, message, live } = useApiAction();
  const [developmentToken, setDevelopmentToken] = useState("");
  async function send(form: HTMLFormElement, body: unknown, completion: { en: string; ar: string }) {
    let token = "";
    const completed = await perform(async () => {
      const data = await requestApi<{ developmentToken?: string }>("/api/v1/auth/password-reset", { method: "POST", body });
      token = data.developmentToken ?? "";
    }, completion);
    if (completed) { setDevelopmentToken(token); form.reset(); }
  }
  return <details className="panel" open={Boolean(search.get("resetToken"))}><summary>{text("Forgot password?", "نسيت كلمة المرور؟")}</summary><form onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; void send(form, { email: new FormData(form).get("email") }, { en: "Reset request accepted. Check your email.", ar: "تم قبول طلب إعادة التعيين. تحقق من بريدك." }); }}><input name="email" type="email" required placeholder={text("Account email", "بريد الحساب")} /><button className="secondary" disabled={pending}>{text("Request reset", "طلب إعادة التعيين")}</button></form><form onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); void send(form, { token: values.get("token"), password: values.get("password") }, { en: "Password reset completed. You can sign in.", ar: "اكتملت إعادة تعيين كلمة المرور. يمكنك تسجيل الدخول." }); }}><input name="token" required defaultValue={search.get("resetToken") ?? ""} placeholder={text("Reset token", "رمز إعادة التعيين")} /><input name="password" type="password" minLength={12} required placeholder={text("New password", "كلمة المرور الجديدة")} /><button className="secondary" disabled={pending}>{text("Complete reset", "إكمال إعادة التعيين")}</button></form>{developmentToken ? <output className="secret">{text("Local reset token", "رمز إعادة التعيين المحلي")}: {developmentToken}</output> : null}<p aria-live={live}>{message}</p></details>;
}
