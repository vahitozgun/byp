import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_ONLY     = ["/dashboard/staff"];
const ADMIN_MANAGER  = ["/dashboard/products"];
const PUBLIC = ["/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password", "/api/register"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL(user ? "/dashboard" : "/auth/login", request.url));
  }

  if (!user && !PUBLIC.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && PUBLIC.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (user && (ADMIN_ONLY.some(r => pathname.startsWith(r)) || ADMIN_MANAGER.some(r => pathname.startsWith(r)))) {
    const { data: profile } = await supabase
      .from("users").select("role, is_active").eq("id", user.id).single();
    if (!profile || !profile.is_active) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (ADMIN_ONLY.some(r => pathname.startsWith(r)) && profile.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (ADMIN_MANAGER.some(r => pathname.startsWith(r)) && profile.role !== "admin" && profile.role !== "manager") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
