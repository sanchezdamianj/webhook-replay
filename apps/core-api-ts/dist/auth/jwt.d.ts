import type { Env } from "../config/env.js";
export type JwtPayload = {
    user_id: number;
    account_id: number;
};
export declare function encodeToken(env: Env, payload: JwtPayload): string;
export declare function decodeToken(env: Env, token: string): JwtPayload;
