import { NextResponse } from "next/server";
import { googleFetchAuto } from "@/lib/google/api";

/**
 * Qué secciones tiene el Drive de la cuenta conectada.
 *
 * Una cuenta de Google normal (Gmail / Google One) tiene "Mi unidad" y
 * "Compartido conmigo". Una cuenta de Google Workspace tiene además las
 * **Unidades compartidas**: carpetas que pertenecen a la organización y no a
 * la persona, de modo que siguen ahí cuando alguien se va de la empresa. En
 * una empresa suele ser justo donde vive lo importante.
 *
 * El tipo de cuenta NO se le pregunta a nadie: se le pregunta a Google. Esta
 * ruta pide la lista de unidades compartidas y decide por el resultado, que es
 * más fiable que cualquier etiqueta — si Google las devuelve, existen y se
 * pueden leer; si no, no hay nada que enseñar.
 *
 * SOLO LECTURA.
 */

export type Seccion = {
  clave: string;
  nombre: string;
  /** Las unidades compartidas se listan por id; las otras dos, por su nombre. */
  driveId?: string;
};

type Drive = { id: string; name: string };

export async function GET() {
  const secciones: Seccion[] = [
    { clave: "mi-unidad", nombre: "Mi unidad" },
    { clave: "compartido", nombre: "Compartido conmigo" },
  ];

  const url = new URL("https://www.googleapis.com/drive/v3/drives");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("fields", "drives(id,name)");

  const { data, needsReauth } = await googleFetchAuto<{ drives?: Drive[] }>(
    url.toString(),
  );

  if (needsReauth) {
    return NextResponse.json({ error: "reauth" }, { status: 401 });
  }

  // Sin unidades compartidas (o cuenta que no es de Workspace) Google responde
  // con una lista vacía o con un error de permisos. Ninguno de los dos casos es
  // un fallo: significa que esta cuenta solo tiene las dos secciones de
  // siempre, así que se devuelven sin ruido.
  for (const d of data?.drives ?? []) {
    secciones.push({ clave: `unidad:${d.id}`, nombre: d.name, driveId: d.id });
  }

  return NextResponse.json({ secciones });
}
