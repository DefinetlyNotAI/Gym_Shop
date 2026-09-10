import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { PoolClient } from "@neondatabase/serverless";
import { getRuntimeConfig } from "@/lib/config/env";

type SecretPayload = {
  destination: string;
  token: string;
  actionUrl?: string;
};

function key(): Buffer {
  const encoded = getRuntimeConfig().OUTBOUND_SECRET_KEY;
  if (!encoded) {
    if (process.env.APP_ENV === "local" || process.env.APP_ENV === "test" || !process.env.APP_ENV) {
      return Buffer.alloc(32, 7);
    }
    throw new Error("OUTBOUND_SECRET_KEY_UNCONFIGURED");
  }
  const decoded = Buffer.from(encoded, "base64url");
  if (decoded.length !== 32) throw new Error("OUTBOUND_SECRET_KEY_INVALID");
  return decoded;
}

export function encryptOutboundSecret(payload: SecretPayload): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), nonce);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptOutboundSecret(envelope: string): SecretPayload {
  const [version, nonceValue, tagValue, ciphertextValue] = envelope.split(".");
  if (version !== "v1" || !nonceValue || !tagValue || !ciphertextValue) {
    throw new Error("OUTBOUND_SECRET_INVALID");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(nonceValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as SecretPayload;
}

export async function storeOutboundSecret(
  client: PoolClient,
  eventId: string,
  payload: SecretPayload,
  expiresAt: Date,
): Promise<void> {
  await client.query(
    "INSERT INTO outbound_secret(event_id,ciphertext,expires_at) VALUES($1,$2,$3)",
    [eventId, encryptOutboundSecret(payload), expiresAt],
  );
}
