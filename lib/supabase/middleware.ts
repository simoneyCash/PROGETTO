import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

// Rotte pubbliche (raggiungibili senza login).
// /onboarding: l'anamnesi a link, compilata da un lead che non ha un account.
// /api/onboarding: l'endpoint a cui il questionario invia le risposte (stesso
// flusso senza account). Sicurezza garantita NON dal login ma dal token: la
// rotta lo risolve lato server con la service role e timbra tenant_id dal record.
// /attiva: il cliente sceglie la password e attiva il proprio account dal link
// generato dal coach (stesso modello a token, account creato lato server).
const PUBLIC_PATHS = ["/login", "/onboarding", "/api/onboarding", "/attiva"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Rinfresca la sessione Supabase a ogni richiesta e protegge le rotte:
 * gli utenti non autenticati vengono mandati a /login.
 * Pattern ufficiale @supabase/ssr per Next.js App Router.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: non inserire codice tra createServerClient e getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Non autenticato su rotta protetta -> login.
  if (!user && !isPublic(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  // Autenticato che apre /login -> home (dispatcher per ruolo).
  // Solo /login: /onboarding resta accessibile anche da loggati (es. anteprima).
  if (user && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
