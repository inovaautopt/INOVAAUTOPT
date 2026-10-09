import "server-only";
import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "validation_error"
  | "rate_limited"
  | "rejected"
  | "not_found"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "unavailable"
  | "internal_error";

const STATUS: Record<ApiErrorCode, number> = {
  validation_error: 422,
  rate_limited: 429,
  rejected: 400,
  not_found: 404,
  unauthorized: 401,
  forbidden: 403,
  conflict: 409,
  unavailable: 503,
  internal_error: 500,
};

/** Formato único de erro. Nunca inclui stack traces nem detalhes internos. */
export function apiError(code: ApiErrorCode, message: string, fields?: Record<string, string>) {
  return NextResponse.json({ ok: false, error: { code, message, ...(fields ? { fields } : {}) } }, { status: STATUS[code] });
}

export function apiOk<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readJson(req: Request, maxBytes = 64_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("payload_too_large");
  return text ? JSON.parse(text) : {};
}
