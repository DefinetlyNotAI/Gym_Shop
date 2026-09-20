import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export type ApiError = {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
};

const noStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, { ...init, headers: { ...noStoreHeaders, ...init?.headers } });
}

export function apiError(status: number, error: ApiError) {
  const reference = `err_${randomBytes(16).toString("hex")}`;
  return NextResponse.json(
    { error: { ...error, reference } },
    {
      status,
      headers: { ...noStoreHeaders, "X-Error-Reference": reference },
    },
  );
}
