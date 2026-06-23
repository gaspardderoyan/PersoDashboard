import { timingSafeEqual } from "node:crypto";
import type { Env } from "./types";

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireBearerToken(request: Request, env: Env, key: string) {
  const expectedToken = env[key];

  if (!expectedToken) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "server_misconfigured", code: `missing_${key.toLowerCase()}` },
        { status: 500 },
      ),
    };
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!constantTimeEqual(authorization, `Bearer ${expectedToken}`)) {
    return { ok: false as const, response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }

  return { ok: true as const };
}
