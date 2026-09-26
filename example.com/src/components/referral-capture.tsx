"use client";

import { useEffect } from "react";

export function ReferralCapture({ code }: { code?: string }) {
  useEffect(() => {
    const normalized = code?.trim().toUpperCase();
    if (!normalized || !/^[A-Z0-9_-]{6,24}$/.test(normalized)) return;
    localStorage.setItem("gym-shop-referral", JSON.stringify({ code: normalized, expiresAt: Date.now() + 30 * 86_400_000 }));
  }, [code]);
  return null;
}
