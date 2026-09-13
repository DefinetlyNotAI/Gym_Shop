"use client";
import { presentApiError } from "@/lib/api-errors";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { customerAction } from "@/lib/customer-actions";

export function SignOutButton() {
  const { text } = useLanguage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await customerAction({ kind: "logout" });
      if (result.authenticated !== false)
        throw new Error(
          text(
            "Sign-out was not confirmed. Please retry.",
            "لم يتم تأكيد تسجيل الخروج. حاول مجددًا.",
          ),
        );
      // Full navigation discards private client state and stale account pages.
      window.location.reload();
    } catch (error) {
      setError(presentApiError(error));
      setPending(false);
    }
  }
  return (
    <div className="account-session-action">
      <button
        className="secondary"
        type="button"
        disabled={pending}
        onClick={signOut}
      >
        {pending
          ? text("Signing out…", "جارٍ تسجيل الخروج…")
          : text("Sign out", "تسجيل الخروج")}
      </button>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
