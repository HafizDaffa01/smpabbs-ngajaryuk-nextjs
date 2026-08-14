import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getSession();

  const path = request.nextUrl.pathname;

  // Protected routes - require authentication
  const protectedRoutes = [
    '/admin',
    '/absensi',
    '/journal',
    '/prevSmes',
    '/profile',
    '/schedule',
    '/import-students',
    '/backup',
    '/explorer',
    '/export',
  ];

  const isProtectedRoute = protectedRoutes.some(
    (route) => path === route || path.startsWith(route + "/")
  );

  if (isProtectedRoute) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      const url = new URL("/login", request.url);
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }

    // Admin-only routes
    const adminRoutes = [
      '/admin',
      '/backup',
      '/explorer',
      '/export',
    ];

    const isAdminRoute = adminRoutes.some(
      (route) => path === route || path.startsWith(route + "/")
    );

    if (isAdminRoute) {
      const { data: user } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single();

      if (!user?.is_admin) {
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
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
