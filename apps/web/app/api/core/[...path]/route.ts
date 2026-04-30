import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000";

async function proxy(req: Request, params: { path: string[] }) {
  const token = (await cookies()).get("wr_token")?.value;
  const url = `${API_BASE_URL}/${params.path.join("/")}${new URL(req.url).search}`;

  const headers = new Headers(req.headers);
  headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
  headers.delete("host");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const res = await fetch(url, {
    method: req.method,
    headers,
    body: hasBody ? await req.text() : undefined,
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "application/json";
  const bodyText = await res.text();

  return new NextResponse(bodyText, {
    status: res.status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params);
}
export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params);
}
export async function PATCH(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params);
}
export async function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, await ctx.params);
}

