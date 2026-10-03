import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.cookies.toString());
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        },
      },
    }
  );

  await supabase.auth.getClaims();

  const path = request.nextUrl.pathname;

  // Protected routes - require authentication
  // Matches Laravel route middleware: auth + admin where applicable
  const protectedRoutes = [
    '/admin',
    '/absensi',
    '/journal',
    '/prevSmes',
    '/profile',
    '/backup',
    '/explorer',
    '/export',
  ];

  const isProtectedRoute = protectedRoutes.some(
    (route) => path === route || path.startsWith(route + "/")
  );

  if (isProtectedRoute) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }

    // Admin-only routes - matches Laravel AdminMiddleware
    const adminRoutes = [
      '/admin',
      '/backup',
      '/explorer',
      '/export',
      '/admin/import',
      '/admin/import-teachers',
    ];

    const isAdminRoute = adminRoutes.some(
      (route) => path === route || path.startsWith(route + "/")
    );

    if (isAdminRoute) {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!userProfile?.is_admin) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    }
  }

  // Public routes - redirect to dashboard if already logged in
  const publicRoutes = ["/login"];
  const isPublicRoute = publicRoutes.some(
    (route) => path === route || path.startsWith(route + "/")
  );

  if (isPublicRoute) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
