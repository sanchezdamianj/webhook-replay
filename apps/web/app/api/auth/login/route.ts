import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000";

type AuthPayload = {
  token: string;
  user?: unknown;
  account?: unknown;
};

function isAuthPayload(v: unknown): v is AuthPayload {
  return typeof (v as { token?: unknown } | null)?.token === "string";
}

export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(`${API_BASE_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const raw = await res.text();
  const data: unknown = (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  })();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  if (!isAuthPayload(data)) {
    return NextResponse.json({ error: "missing_token" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, user: data.user, account: data.account });
  response.cookies.set("wr_token", data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
  return response;
}

