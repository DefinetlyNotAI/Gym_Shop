"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import {
  ApiFailure,
  apiErrorFromPayload,
  presentApiError,
} from "@/lib/api-errors";

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
function base64(bytes: ArrayBuffer) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function PrivateMediaUpload({
  onUploaded,
  accept = "image/jpeg,image/png,image/webp",
  required = false,
}: {
  onUploaded: (id: string) => void;
  accept?: string;
  required?: boolean;
}) {
  const { text } = useLanguage();
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage(text("Uploading…", "جارٍ الرفع…"));
    try {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        await file.arrayBuffer(),
      );
      const create = await fetch("/api/v1/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mime: file.type,
          byteSize: file.size,
          sha256: hex(digest),
        }),
      });
      const created = await create.json().catch(() => null);
      if (!create.ok) throw apiErrorFromPayload(created, create.status);
      if (
        typeof created?.data?.id !== "string" ||
        typeof created?.data?.uploadUrl !== "string"
      ) {
        throw new ApiFailure("INVALID_RESPONSE", create.status);
      }
      const put = await fetch(created.data.uploadUrl, {
        method: "PUT",
        headers: {
          "content-type": file.type,
          "x-amz-checksum-sha256": base64(digest),
        },
        body: file,
      });
      if (!put.ok) throw new ApiFailure("UPLOAD_TRANSFER_FAILED", put.status);
      const finalize = await fetch("/api/v1/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ finalize: true, id: created.data.id }),
      });
      const finalized = await finalize.json().catch(() => null);
      if (!finalize.ok) throw apiErrorFromPayload(finalized, finalize.status);
      if (typeof finalized?.data?.ready !== "boolean") {
        throw new ApiFailure("INVALID_RESPONSE", finalize.status);
      }
      onUploaded(created.data.id);
      setFile(null);
      setMessage(
        finalized.data.ready
          ? text("Image attached.", "تم إرفاق الصورة.")
          : text(
              "Image received and awaiting its security scan.",
              "تم استلام الصورة وهي بانتظار الفحص الأمني.",
            ),
      );
    } catch (error) {
      setMessage(presentApiError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="private-media-upload">
      <label>
        {text(
          required
            ? "Private evidence (required)"
            : "Private evidence (optional)",
          required ? "دليل خاص (مطلوب)" : "دليل خاص (اختياري)",
        )}
        <input
          type="file"
          accept={accept}
          disabled={busy}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <button
        type="button"
        className="secondary"
        onClick={upload}
        disabled={!file || busy}
      >
        {text(
          busy ? "Uploading…" : "Attach image",
          busy ? "جارٍ الرفع…" : "إرفاق صورة",
        )}
      </button>
      <small aria-live="polite">{message}</small>
    </div>
  );
}
