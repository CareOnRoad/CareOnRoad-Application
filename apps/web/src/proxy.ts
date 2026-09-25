import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (Next.js 16+) — forward pathname sang server components để root layout
 * có thể quyết định render Header/Footer marketing hay không (segment `/admin`
 * tự có chrome riêng).
 *
 * Trước Next 16 convention này tên là `middleware`; từ Next 16 đổi thành `proxy`.
 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
