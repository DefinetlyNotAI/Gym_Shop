"use client";

import { useState } from "react";

function hex(bytes: ArrayBuffer) { return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
function base64(bytes: ArrayBuffer) { let binary = ""; for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte); return btoa(binary); }

export function PrivateMediaUpload({ onUploaded, accept = "image/jpeg,image/png,image/webp" }: { onUploaded: (id: string) => void; accept?: string }) {
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  async function upload() {
    if (!file) return;
    setMessage("Uploading…");
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const create = await fetch("/api/v1/media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mime: file.type, byteSize: file.size, sha256: hex(digest) }) });
      const created = await create.json();
      if (!create.ok) throw new Error(created.error?.code ?? "UPLOAD_CREATE_FAILED");
      const put = await fetch(created.data.uploadUrl, { method: "PUT", headers: { "content-type": file.type, "x-amz-checksum-sha256": base64(digest) }, body: file });
      if (!put.ok) throw new Error("UPLOAD_TRANSFER_FAILED");
      const finalize = await fetch("/api/v1/media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ finalize: true, id: created.data.id }) });
      const finalized = await finalize.json();
      if (!finalize.ok) throw new Error(finalized.error?.code ?? "UPLOAD_FINALIZE_FAILED");
      onUploaded(created.data.id);
      setMessage(finalized.data.ready ? "Upload ready." : "Upload received and awaiting its security scan.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed"); }
  }
  return <div><input type="file" accept={accept} required onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><button type="button" className="secondary" onClick={upload} disabled={!file}>Upload private evidence</button><small aria-live="polite">{message}</small></div>;
}
