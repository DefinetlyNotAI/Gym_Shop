"use client";

import { useState } from "react";

export function ReorderButton({ publicId }: { publicId: string }) {
  const [message, setMessage] = useState("");

  async function reorder() {
    const response = await fetch(`/api/v1/orders/${encodeURIComponent(publicId)}/reorder`, { method: "POST" });
    const body = await response.json();
    setMessage(
      response.ok
        ? `${body.data.added.length} line(s) copied as unselected saved items. Review current prices and stock in your cart.`
        : body.error?.message ?? "Reorder failed",
    );
  }

  return (
    <div>
      <button className="secondary" onClick={reorder}>
        Reorder into saved cart / إعادة الطلب
      </button>
      <small aria-live="polite">{message}</small>
    </div>
  );
}
