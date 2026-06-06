import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/supabase/get-context";

/**
 * PRP-054 · Fase 3 — Servidores ICE para las llamadas internas.
 *
 * Por defecto solo STUN público (gratis, sin cuenta ni alta en nada externo):
 * cubre la gran mayoría de llamadas (mismo wifi, redes domésticas, datos móviles).
 *
 * TURN es OPCIONAL y solo se incluye si están definidas las env de servidor
 * (TURN_URLS / TURN_USERNAME / TURN_CREDENTIAL). Así, el día que haga falta
 * cubrir el ~15% de redes muy cerradas, basta con definir esas variables: el
 * código no cambia. Las credenciales NUNCA se hardcodean ni llegan al bundle.
 */

type IceServer = { urls: string | string[]; username?: string; credential?: string };

const STUN_SERVERS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
];

export async function GET() {
  const { userId } = await getAppContext();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const iceServers: IceServer[] = [{ urls: STUN_SERVERS }];

  const turnUrls = process.env.TURN_URLS?.trim();
  const turnUsername = process.env.TURN_USERNAME?.trim();
  const turnCredential = process.env.TURN_CREDENTIAL?.trim();
  if (turnUrls && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrls.split(",").map((u) => u.trim()).filter(Boolean),
      username: turnUsername,
      credential: turnCredential,
    });
  }

  // No cachear: las credenciales TURN (cuando existan) pueden ser temporales.
  return NextResponse.json({ iceServers }, { headers: { "Cache-Control": "no-store" } });
}
