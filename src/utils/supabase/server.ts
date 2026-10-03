import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(cookieStore.toString());
        },
        setAll() {
        },
      },
    },
  );
};

export const createServiceClient = () => {
  return createServerClient(
    supabaseUrl!,
    supabaseServiceRoleKey!,
    {
      cookies: {
        getAll() {
          return [];
        },
      },
    },
  );
};
