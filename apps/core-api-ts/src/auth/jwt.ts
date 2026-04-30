import jwt from "jsonwebtoken";
import type { Env } from "../config/env.js";

export type JwtPayload = {
  user_id: number;
  account_id: number;
};

export function encodeToken(env: Env, payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { algorithm: "HS256" });
}

export function decodeToken(env: Env, token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  if (typeof decoded !== "object" || decoded == null) throw new Error("invalid_payload");
  const user_id = Number((decoded as Record<string, unknown>).user_id);
  const account_id = Number((decoded as Record<string, unknown>).account_id);
  if (!Number.isFinite(user_id) || !Number.isFinite(account_id)) throw new Error("invalid_payload");
  return { user_id, account_id };
}
