import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("wr_token")?.value;
  const { pathname } = req.nextUrl;

  // If already logged in, keep them out of /login.
  if (pathname.startsWith("/login") && token) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login"],
};

