"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";

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
  label,
}: {
  onUploaded: (id: string, ready?: boolean) => void;
  accept?: string;
  label?: string;
}) {
  const { text } = useLanguage();
  const caption = label ?? text("Upload private evidence", "رفع مرفق خاص");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  async function upload() {
    if (!file || pending) return;
    if (file.size > 10 * 1024 * 1024) {
      setMessage(
        text(
          "Choose a file no larger than 10 MB.",
          "اختر ملفاً لا يتجاوز ١٠ ميغابايت.",
        ),
      );
      return;
    }
    setPending(true);
    setMessage("");
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
      const created = await create.json();
      if (!create.ok)
        throw new Error(created.error?.code ?? "UPLOAD_CREATE_FAILED");
      const put = await fetch(created.data.uploadUrl, {
        method: "PUT",
        headers: {
          "content-type": file.type,
          "x-amz-checksum-sha256": base64(digest),
        },
        body: file,
      });
      if (!put.ok) throw new Error("UPLOAD_TRANSFER_FAILED");
      const finalize = await fetch("/api/v1/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ finalize: true, id: created.data.id }),
      });
      const finalized = await finalize.json();
      if (!finalize.ok)
        throw new Error(finalized.error?.code ?? "UPLOAD_FINALIZE_FAILED");
      onUploaded(created.data.id, finalized.data.ready === true);
      setMessage(finalized.data.ready ? "READY" : "SCANNING");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : text("Upload failed", "تعذر رفع الملف"),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="media-upload">
      <label>
        {caption}
        <input
          type="file"
          accept={accept}
          disabled={pending}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setMessage("");
          }}
        />
      </label>
      <button
        type="button"
        className="secondary"
        onClick={upload}
        disabled={!file || pending}
      >
        {pending ? text("Uploading…", "جارٍ الرفع…") : caption}
      </button>
      <small aria-live="polite">
        {message === "READY"
          ? text("Upload ready.", "الملف جاهز.")
          : message === "SCANNING"
            ? text(
                "Upload received and awaiting its security scan.",
                "تم استلام الملف وبانتظار الفحص الأمني.",
              )
            : message}
      </small>
    </div>
  );
}
