"use client";

import { useState } from "react";
import { PrivateMediaUpload } from "@/components/private-media-upload";

async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.code ?? "DELIVERY_ACTION_FAILED");
  return result.data;
}

export function DeliveryActions({ publicId, paymentMethod, doorstepAuthorized }: { publicId: string; paymentMethod: string; doorstepAuthorized: boolean }) {
  const [message, setMessage] = useState("");
  const [proofMediaId, setProofMediaId] = useState("");
  async function run(action: () => Promise<unknown>) { try { await action(); location.reload(); } catch (error) { setMessage(error instanceof Error ? error.message : "Delivery action failed"); } }
  return (
    <details>
      <summary>Record attempt / تسجيل المحاولة</summary>
      <button className="secondary" onClick={() => run(() => post(`/api/v1/deliveries/${publicId}/accept`, {}))}>Accept package and cash custody</button>
      <form action={(form) => run(() => post(`/api/v1/deliveries/${publicId}/complete`, { pin: form.get("pin") || undefined, collectedFils: form.get("collectedFils") ? Number(form.get("collectedFils")) : undefined }))}>
        <input name="pin" inputMode="numeric" pattern="[0-9]{6}" placeholder="Customer PIN" required />
        {paymentMethod === "COD" ? <input name="collectedFils" type="number" min="0" placeholder="Exact collected fils" required /> : null}
        <button className="primary">Complete attended delivery</button>
      </form>
      {paymentMethod === "CARD" && doorstepAuthorized ? (
        <><PrivateMediaUpload onUploaded={setProofMediaId} /><form action={(form) => run(() => post(`/api/v1/deliveries/${publicId}/complete`, { doorstep: true, proofMediaId, location: { latitude: Number(form.get("latitude")), longitude: Number(form.get("longitude")) } }))}>
          <input type="hidden" value={proofMediaId} readOnly />
          <input name="latitude" type="number" step="any" min="-90" max="90" required placeholder="Latitude" />
          <input name="longitude" type="number" step="any" min="-180" max="180" required placeholder="Longitude" />
          <button className="secondary" disabled={!proofMediaId}>Complete safe doorstep delivery</button>
        </form></>
      ) : null}
      <form action={(form) => run(() => post(`/api/v1/deliveries/${publicId}/fail`, { reason: form.get("reason"), contactEffort: form.get("contactEffort") }))}>
        <select name="reason" required defaultValue="">
          <option value="" disabled>Failure reason</option>
          <option value="CUSTOMER_UNAVAILABLE">Customer unavailable</option><option value="WRONG_ADDRESS">Wrong address</option><option value="CUSTOMER_RESCHEDULE">Customer requested reschedule</option><option value="CUSTOMER_REFUSED">Customer refused</option><option value="INACCESSIBLE">Inaccessible location</option><option value="OTHER">Other</option>
        </select>
        <textarea name="contactEffort" minLength={3} maxLength={500} required placeholder="Contact effort and details" />
        <button className="secondary">Record failed attempt</button>
      </form>
      <small aria-live="polite">{message}</small>
    </details>
  );
}
