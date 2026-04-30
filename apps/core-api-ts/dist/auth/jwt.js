import jwt from "jsonwebtoken";
export function encodeToken(env, payload) {
    return jwt.sign(payload, env.JWT_SECRET, { algorithm: "HS256" });
}
export function decodeToken(env, token) {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof decoded !== "object" || decoded == null)
        throw new Error("invalid_payload");
    const user_id = Number(decoded.user_id);
    const account_id = Number(decoded.account_id);
    if (!Number.isFinite(user_id) || !Number.isFinite(account_id))
        throw new Error("invalid_payload");
    return { user_id, account_id };
}
