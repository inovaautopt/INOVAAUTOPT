import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Renova a sessão Supabase dos colaboradores nas rotas do painel (cookies de acesso expiram).
 * A autorização real é feita no servidor em cada página/ação (src/server/auth.ts) e na base de
 * dados (RLS); este proxy não decide permissões.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (process.env.AUTH_PROVIDER !== "supabase" || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return response;
  }
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
