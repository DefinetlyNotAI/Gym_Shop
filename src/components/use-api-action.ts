"use client";
import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import {
  errorNotice,
  presentApiError,
  type ErrorNotice,
  type LocalizedCopy,
} from "@/lib/api-errors";
import { createActionGate } from "@/lib/action-gate";

export function useApiAction() {
  const { language } = useLanguage();
  const [gate] = useState(createActionGate);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<ErrorNotice | null>(null);
  const [success, setSuccess] = useState<LocalizedCopy | null>(null);
  async function perform(
    action: () => Promise<void>,
    successCopy?: LocalizedCopy,
  ): Promise<boolean> {
    try {
      return await gate.run(async () => {
        setNotice(null);
        setSuccess(null);
        await action();
        setSuccess(successCopy ?? null);
      }, setPending);
    } catch (error) {
      setNotice(errorNotice(error));
      presentApiError(error);
      return false;
    }
  }
  return {
    pending,
    perform,
    message: notice?.description[language] ?? success?.[language] ?? "",
    live: notice ? ("off" as const) : ("polite" as const),
  };
}
