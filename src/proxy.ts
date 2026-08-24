import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const PUBLIC_PATHS = ["/login"];

/**
 * Edge-safe first line of defense: redirects based on cookie *presence* only.
 * The cookie's validity (expiry, revocation, permissions) is always re-checked
 * server-side via `getCurrentUser()` in layouts/pages/route handlers, which run
 * in the Node.js runtime and can reach the database — the proxy cannot.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!req.cookies.get(SESSION_COOKIE_NAME)?.value;

  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!hasSession && !isPublicPath) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isPublicPath) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Public static assets (images, fonts, etc.) never require a session — without
  // this, an asset referenced from the login page itself (e.g. its background
  // photo) gets redirected to /login before it can load.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff2?|ttf)$).*)"],
};
