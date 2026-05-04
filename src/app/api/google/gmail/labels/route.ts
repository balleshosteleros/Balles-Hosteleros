import { NextResponse } from "next/server";
import { googleFetchAuto } from "@/lib/google/api";

type Label = {
  id: string;
  name: string;
  type?: "system" | "user";
  labelListVisibility?: string;
};
type LabelList = { labels?: Label[] };

/**
 * Devuelve solo las etiquetas creadas por el usuario (no las del sistema:
 * INBOX, SENT, DRAFT, TRASH, SPAM…). Estas son las "carpetas" que el usuario
 * tiene configuradas manualmente en Gmail.
 */
export async function GET() {
  const r = await googleFetchAuto<LabelList>(
    "https://gmail.googleapis.com/gmail/v1/users/me/labels",
  );
  if (r.needsReauth) {
    return NextResponse.json({ needsReauth: true, carpetas: [] }, { status: 401 });
  }
  const todas = r.data?.labels ?? [];
  const carpetas = todas
    .filter((l) => l.type === "user")
    // Gmail usa "/" para carpetas anidadas; conservamos el nombre completo
    .map((l) => ({ id: l.id, nombre: l.name }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return NextResponse.json({ carpetas });
}
