import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

/**
 * Edge-safe first line of defense: only ever redirects based on cookie
 * *absence* — a session-less request to a protected path bounces to /login.
 * It deliberately does NOT redirect public paths away just because a cookie
 * is present: cookie presence isn't proof of a *valid* session (expired,
 * revoked, or deactivated-user sessions still carry a cookie), and the edge
 * runtime has no DB access to check. Treating presence as "authenticated"
 * here previously caused an infinite /dashboard <-> /login redirect loop
 * for anyone with a stale cookie: the layout's DB-validated `getCurrentUser()`
 * would reject it and send them to /login, and this proxy would immediately
 * bounce them right back to /dashboard on cookie presence alone — an
 * unconditional two-node cycle. The "already authenticated -> skip /login"
 * behavior now lives in the login page itself, which *can* reach the DB via
 * `getCurrentUser()`, so it only fires on an actually-valid session.
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

  return NextResponse.next();
}

export const config = {
  // Public static assets (images, fonts, etc.) never require a session — without
  // this, an asset referenced from the login page itself (e.g. its background
  // photo) gets redirected to /login before it can load.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff2?|ttf)$).*)"],
};
