import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (Next.js 16+) — forward pathname sang server components để root layout
 * có thể quyết định render Header/Footer marketing hay không (segment `/admin`
 * tự có chrome riêng).
 *
 * Trước Next 16 convention này tên là `middleware`; từ Next 16 đổi thành `proxy`.
 *
 * Ngoài việc set `x-pathname`, proxy này còn refresh Supabase session. Supabase
 * dùng cookie access token ngắn hạn; không refresh ở đây thì request admin
 * sau khi token hết hạn sẽ bị guard đẩy về login dù người dùng vẫn đang đăng nhập.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && publishableKey) {
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        }
      }
    });

    // Chỉ gọi getUser(): nó validate token với Supabase Auth server. Nếu token hết
    // hạn, Supabase tự refresh và set cookie mới qua setAll ở trên.
    await supabase.auth.getUser();
  }

  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
