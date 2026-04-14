import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  // Cierra sesión en el servidor — esto limpia las cookies de Supabase SSR
  await supabase.auth.signOut();

  const response = NextResponse.redirect(`${origin}/`, { status: 302 });

  // Limpiar también las cookies de Google que se crean en el callback OAuth
  response.cookies.delete("g_access_token");
  response.cookies.delete("g_refresh_token");
  response.cookies.delete("g_email");

  return response;
}
