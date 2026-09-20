"use client";

import { useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import { ApiFailure, readApiData } from "@/lib/api-errors";
import { resendRecoveryCode } from "@/lib/driver-recovery-actions";

type RecoveryStep = "START" | "EMAIL_OTP" | "PASSPHRASE" | "PHONE_OTP" | "WEBAUTHN";

async function postRecovery<T>(path: string, body: unknown): Promise<T> {
  return readApiData<T>(
    await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function validDevelopmentCode(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{6}$/.test(value);
}

export function RecoveryEntry() {
  const { text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  const [id, setId] = useState("");
  const [step, setStep] = useState<RecoveryStep>("START");
  const [developmentCode, setDevelopmentCode] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [publicStatus, setPublicStatus] = useState("");
  const [binding] = useState(() => {
    const current =
      sessionStorage.getItem("gym-recovery-binding") ?? crypto.randomUUID();
    sessionStorage.setItem("gym-recovery-binding", current);
    return current;
  });

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = window.setInterval(
      () => setSecondsRemaining((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [secondsRemaining]);

  function startResendCooldown() {
    setSecondsRemaining(60);
  }

  async function start(form: HTMLFormElement) {
    const values = new FormData(form);
    await perform(
      async () => {
        const data = await postRecovery<{
          accepted?: unknown;
          recoveryId?: unknown;
          developmentEmailCode?: unknown;
        }>("/api/v1/recovery/start", {
          email: values.get("email"),
          captcha: "local-human",
          browserBinding: binding,
        });
        if (!data || data.accepted !== true) {
          throw new ApiFailure("INVALID_RESPONSE");
        }
        if (typeof data.recoveryId !== "string") {
          setPublicStatus(
            text(
              "If the account is eligible, recovery instructions have been sent securely.",
              "إذا كان الحساب مؤهلاً، فقد أُرسلت تعليمات الاسترداد بأمان.",
            ),
          );
          return;
        }
        setId(data.recoveryId);
        setStep("EMAIL_OTP");
        setDevelopmentCode(
          validDevelopmentCode(data.developmentEmailCode)
            ? data.developmentEmailCode
            : "",
        );
        setPublicStatus("");
        startResendCooldown();
      },
      {
        en: "Recovery request accepted. Continue with the registered security factors.",
        ar: "تم قبول طلب الاسترداد. تابع باستخدام عوامل الأمان المسجّلة.",
      },
    );
  }

  async function advance(form: HTMLFormElement) {
    const values = new FormData(form);
    await perform(
      async () => {
        const data = await postRecovery<{
          step?: unknown;
          developmentPhoneCode?: unknown;
          options?: Parameters<typeof startAuthentication>[0]["optionsJSON"];
        }>("/api/v1/recovery/step", {
          id,
          browserBinding: binding,
          step,
          value: values.get("value"),
        });
        if (data.step === "PASSPHRASE") {
          setStep("PASSPHRASE");
          setDevelopmentCode("");
          return;
        }
        if (data.step === "PHONE_OTP") {
          setStep("PHONE_OTP");
          setDevelopmentCode(
            validDevelopmentCode(data.developmentPhoneCode)
              ? data.developmentPhoneCode
              : "",
          );
          startResendCooldown();
          return;
        }
        if (data.step === "WEBAUTHN" && data.options) {
          setStep("WEBAUTHN");
          setDevelopmentCode("");
          const response = await startAuthentication({ optionsJSON: data.options });
          const completed = await postRecovery<{ emergencySession?: unknown }>(
            "/api/v1/recovery/webauthn",
            { id, browserBinding: binding, response },
          );
          if (completed.emergencySession !== true) {
            throw new ApiFailure("INVALID_RESPONSE");
          }
          location.reload();
          return;
        }
        throw new ApiFailure("INVALID_RESPONSE");
      },
      {
        en: "Security factor verified. Continue to the next factor.",
        ar: "تم التحقق من عامل الأمان. تابع إلى العامل التالي.",
      },
    );
  }

  async function resend() {
    if (step !== "EMAIL_OTP" && step !== "PHONE_OTP") return;
    await perform(
      async () => {
        const result = await resendRecoveryCode({
          recoveryId: id,
          browserBinding: binding,
          channel: step === "EMAIL_OTP" ? "EMAIL" : "PHONE",
        });
        setDevelopmentCode(result.developmentCode ?? "");
        startResendCooldown();
      },
      {
        en: "A replacement code was sent. Earlier codes are no longer valid.",
        ar: "تم إرسال رمز بديل. لم تعد الرموز السابقة صالحة.",
      },
    );
  }

  const otpStep = step === "EMAIL_OTP" || step === "PHONE_OTP";
  const factorLabel =
    step === "PASSPHRASE"
      ? text("Saved 12-token passphrase", "عبارة الاسترداد المحفوظة من ١٢ كلمة")
      : step === "EMAIL_OTP"
        ? text("Email verification code", "رمز التحقق من البريد")
        : text("Phone verification code", "رمز التحقق من الهاتف");

  return (
    <section className="recovery-workspace" aria-labelledby="recovery-flow-title">
      <div className="recovery-overview">
        <div>
          <p className="eyebrow">{text("FIVE-FACTOR RECOVERY", "استرداد بخمسة عوامل")}</p>
          <h2 id="recovery-flow-title">
            {text("Prove every security factor", "أثبت كل عامل أمان")}
          </h2>
        </div>
        <p>
          {text(
            "Every factor is mandatory and the complete flow expires after thirty minutes. Support and database bypasses do not exist.",
            "كل عامل إلزامي وتنتهي مهلة المسار الكامل بعد ثلاثين دقيقة. لا يوجد تجاوز عبر الدعم أو قاعدة البيانات.",
          )}
        </p>
      </div>

      <ol className="recovery-progress" aria-label={text("Recovery progress", "تقدم الاسترداد")}>
        {[
          ["EMAIL_OTP", text("Email", "البريد")],
          ["PASSPHRASE", text("Passphrase", "العبارة")],
          ["PHONE_OTP", text("Phone", "الهاتف")],
          ["WEBAUTHN", text("Security key", "مفتاح الأمان")],
        ].map(([value, label], index) => {
          const currentIndex = ["START", "EMAIL_OTP", "PASSPHRASE", "PHONE_OTP", "WEBAUTHN"].indexOf(step);
          const itemIndex = index + 1;
          return (
            <li
              key={value}
              className={itemIndex < currentIndex ? "is-complete" : itemIndex === currentIndex ? "is-current" : ""}
              aria-current={itemIndex === currentIndex ? "step" : undefined}
            >
              <span>{itemIndex}</span>
              {label}
            </li>
          );
        })}
      </ol>

      {step === "START" ? (
        <form
          className="recovery-factor-card"
          onSubmit={(event) => {
            event.preventDefault();
            void start(event.currentTarget);
          }}
        >
          <div>
            <span className="recovery-step-number">01</span>
            <h3>{text("Start a protected recovery", "بدء استرداد محمي")}</h3>
            <p>
              {text(
                "Use the registered CTO email. The response never reveals whether an account exists.",
                "استخدم بريد مدير التقنية المسجّل. لا تكشف الاستجابة أبداً ما إذا كان الحساب موجوداً.",
              )}
            </p>
          </div>
          <label>
            {text("Registered CTO email", "بريد مدير التقنية المسجّل")}
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button className="primary" disabled={pending}>
            {text(pending ? "Starting…" : "Start secure recovery", pending ? "جارٍ البدء…" : "بدء الاسترداد الآمن")}
          </button>
        </form>
      ) : step !== "WEBAUTHN" ? (
        <div className="recovery-factor-card">
          <div>
            <span className="recovery-step-number">
              {step === "EMAIL_OTP" ? "01" : step === "PASSPHRASE" ? "02" : "03"}
            </span>
            <h3>{factorLabel}</h3>
            <p>
              {step === "PASSPHRASE"
                ? text("Enter the saved recovery phrase exactly. It can only be used once.", "أدخل عبارة الاسترداد المحفوظة كما هي. يمكن استخدامها مرة واحدة فقط.")
                : text("Enter the newest six-digit code. Sending a replacement invalidates the earlier code.", "أدخل أحدث رمز من ستة أرقام. إرسال بديل يلغي الرمز السابق.")}
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void advance(event.currentTarget);
            }}
          >
            <label>
              {factorLabel}
              <input
                name="value"
                type={step === "PASSPHRASE" ? "password" : "text"}
                inputMode={otpStep ? "numeric" : undefined}
                pattern={otpStep ? "[0-9]{6}" : undefined}
                autoComplete={otpStep ? "one-time-code" : "off"}
                required
              />
            </label>
            <button className="primary" disabled={pending}>
              {text(pending ? "Verifying…" : "Verify and continue", pending ? "جارٍ التحقق…" : "تحقق وتابع")}
            </button>
          </form>
          {otpStep ? (
            <div className="recovery-resend-row">
              <p>{text("Didn’t receive the code?", "لم يصلك الرمز؟")}</p>
              <button
                className="ghost"
                type="button"
                disabled={pending || secondsRemaining > 0}
                onClick={() => void resend()}
              >
                {secondsRemaining > 0
                  ? text(`Resend in ${secondsRemaining}s`, `إعادة الإرسال خلال ${secondsRemaining}ث`)
                  : text("Send a replacement code", "إرسال رمز بديل")}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="recovery-factor-card recovery-key-step">
          <span className="recovery-step-number">04</span>
          <h3>{text("Complete the security-key prompt", "أكمل طلب مفتاح الأمان")}</h3>
          <p>{text("Keep this tab open while your browser verifies the registered physical key.", "أبقِ هذه الصفحة مفتوحة أثناء تحقق المتصفح من المفتاح الفعلي المسجّل.")}</p>
        </div>
      )}

      {developmentCode ? (
        <output className="recovery-development-code">
          <span>{text("Local development code", "رمز التطوير المحلي")}</span>
          <strong>{developmentCode}</strong>
        </output>
      ) : null}
      {publicStatus ? <p className="recovery-public-status">{publicStatus}</p> : null}
      <p className="operation-result" aria-live={live}>{message}</p>
    </section>
  );
}
